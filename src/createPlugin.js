/**
 * @Author: eason
 * @Date:   2017-07-09T14:47:00+08:00
 * @Last modified by:   eason
 * @Last modified time: 2017-10-14T03:16:59+08:00
 */
module.exports = function createPlugin(route, namespace, schema, options = {}) {
  const {
    many = {},
    one = {},
  } = options;
  const { list = [], create = [] } = many;
  const { retrieve = [], update = [], del = [] } = one; // eslint-disable-line

  return {
    namespace,

    models: {
      schema: {
        ...schema,
        owner: { type: 'ObjectId', ref: 'User' },
      },
      options: {
        timestamps: true,
        safe: true,
        strict: true,
        toJSON: { virtuals: false },
        versionKey: false,
      },
    },

    middlewares: {
      'locals'(Model, { req, next }) {
        req.locals = {
          query: {},
          select: {},
          sort: {},
        };
        next();
      },
      'format/offset&limit'(Model, { req, next }) {
        req.locals.offset = +req.query.offset || 0;
        req.locals.limit = +req.query.limit || 10;
        next();
      },
      'format/sort'(Model, { req, next }) {
        if (Array.isArray(req.query.sort)) {
          req.locals.sort = req.query.sort.reduce((a, b) => {
            const { sort, name } = b.indexOf('-') !== -1
              ? { sort: -1, name: b.slice(1) }
              : { sort: 1, name: b };
            return Object.assign(a, { [name]: sort });
          }, {});
        } else if (typeof req.query.sort === 'string') {
          const { sort, name } = req.query.sort.indexOf('-') !== -1
            ? { sort: -1, name: req.query.sort.slice(1) }
            : { sort: 1, name: req.query.sort };
          req.locals.sort = { [name]: sort };
        }
        next();
      },
      'format/search'(Models, { req, next }) {
        const { k, s, keywords, sort, offset, limit, ...others } = req.query;
        const kw = k || s || keywords;
        const paths = Models[namespace].schema.obj;
        req.locals.query.$and = [];
        [...Object.keys(paths), 'createdAt', 'updatedAt'].forEach((name) => {
          if (['createdAt', 'updatedAt'].indexOf(name) !== -1 || paths[name].query) {
            // fuzzy search
            if (kw) {
              req.locals.query.$and.push({ [name]: new RegExp(kw, 'igm') });
            }

            // exact search
            if (Object.keys(others).indexOf(name) !== -1) {
              const range = `${others[name]}`.split('-');

              // 1 range search
              if (range.length === 2 && !!range[1]) {
                // const [gte, lt] = [new Date(range[0]), new Date(range[1])];

                // 1.1 date range
                // if (gte.getFullYear() > 1024 & lt.getFullYear() > 1024) {
                //  req.locals.query.$and.push({ [name]: { $gte: gte, $lt: lt } });
                //} else {
                req.locals.query.$and.push({ [name]: { $gte: range[0], $lt: range[1] } });
                //}
              } else {
                if (Array.isArray(others[name])) {
                  // support value not equal @2: nin
                  const $in = [];
                  const $nin = [];
                  for (const v of others[name]) {
                    if (v[0] === '!') {
                      $nin.push(v.slice(1));
                    } else {
                      $in.push(v);
                    }
                  }

                  const conditions = {};
                  if ($in.length > 0) {
                    conditions.$in = $in;
                  }

                  if ($nin.length > 0) {
                    conditions.$nin = $nin;
                  }

                  req.locals.query.$and.push({ [name]: conditions });
                } else if (['true', 'false', ''].includes(others[name])) {
                  req.locals.query.$and.push({ [name]: ['true', ''].includes(others[name]) ? true : false });
                } else {
                  // support value not equal @1: ne
                  if (others[name][0] === '!') {
                    req.locals.query.$and.push({ [name]: { $ne: others[name].slice(1) } });
                  } else {
                    req.locals.query.$and.push({ [name]: others[name] });
                  }
                }
              }
            } else {
              // @TODO
              for (let key in others) {
                //  support a.b = c, and begin with a
                if (key.indexOf(name) === 0 && key[name.length] === '.') {
                  const v = others[key];
                  if (Array.isArray(v)) {
                    req.locals.query.$and.push({ [key]: { $in: v } });
                  } else {
                    if (['true', 'false', ''].includes(v)) {
                      req.locals.query.$and.push({ [key]: ['true', ''].includes(v) ? true : false });
                    } else {
                      req.locals.query.$and.push({ [key]: v });
                    }
                  }
                }
              }
            }
          }
        });

        // delete $and if empty
        if (req.locals.query.$and.length === 0) {
          delete req.locals.query.$and;
        }

        next();
      },
    },

    handlers: {
      list(Model, { req, res, next }) {
        const {
          offset = 0, limit = 10, // eslint-disable-line
          query = {}, sort = {}, select = {}, // eslint-disable-line
        } = req.locals;
        const model = Model[namespace];

        model
          .count(Object.assign({}, query, req.user ? { owner: req.user } : {}))
          .exec((err, total) => {
            if (err) return next(err);

            model
              .find(Object.assign({}, query, req.user ? { owner: req.user } : {}))
              .sort(sort)
              .skip(offset)
              .limit(limit)
              .select(select)
              .lean()
              .exec((error, data) => {
                if (error) return next(err);

                const realCount = data.length;

                return res
                  .status(200)
                  .json({
                    offset,
                    count: realCount,
                    total,
                    data,
                  });
              });
          });
      },

      create(Models, { req, res, next }) {
        const Model = Models[namespace];
        const paths = Model.schema.obj;
        const _object = {};
        const _raw = req.body;

        Object
          .keys(_raw)
          .forEach((key) => {
            if (paths.hasOwnProperty(key)) { // eslint-disable-line
              Object.assign(_object, { [key]: _raw[key] });
            }
          });

        const object = new Model(Object.assign(_object, req.user ? { owner: req.user } : {}));
        object.save((err) => {
          if (err) return next(err);

          res.sendStatus(201);
        });
      },

      retrieve(Models, { req, res, next }) {
        const { id } = req.params;
        const { select = {} } = req.locals;

        Models[namespace]
          .findOne(Object.assign({ _id: id }, req.user ? { owner: req.user } : {}))
          .select(select)
          .exec((err, object) => {
            if (err) return next(err);

            res.status(200).json(object);
          });
      },

      update(Models, { req, res, next }) {
        const { id } = req.params;
        const Model = Models[namespace];
        const paths = Model.schema;

        Model
          .findOne(Object.assign({ _id: id }, req.user ? { owner: req.user } : {}))
          .exec((err, object) => {
            if (err) return next(err);

            const _raw = req.body;
            const _object = {};
            Object
              .keys(_raw)
              .forEach((key) => {
                if (paths.hasOwnProperty(key)) { // eslint-disable-line
                  Object.assign(_object, { [key]: _raw[key] });
                }
              });

            object.update(_object, (error) => { // eslint-disable-line
              return error ? next(error) : res.json(_object);
            });
          });
      },

      delete(Models, { req, res, next }) {
        const { id } = req.params;

        return Models[namespace]
          .remove(Object.assign({ _id: id }, req.user ? { owner: req.user } : {}))
          .exec(error => (error ? next(error) : res.sendStatus(204)));
      },
    },

    routes: {
      [route]: {
        get: list.concat(['locals', 'format/offset&limit', 'format/search', 'format/sort', 'list']),
        post: create.concat(['locals', 'create']),
      },
      [`${route}/:id`]: {
        get: retrieve.concat(['locals', 'retrieve']),
        put: update.concat(['locals', 'update']),
        delete: del.concat(['locals', 'delete']),
      },
    },
  };
};
