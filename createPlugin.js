/**
 * @Author: eason
 * @Date:   2017-07-09T14:47:00+08:00
 * @Last modified by:   eason
 * @Last modified time: 2017-07-09T19:03:38+08:00
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
      schema,
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
        const { k, s, keywords } = req.query;
        const kw = k || s || keywords;
        const paths = Models[namespace].schema.obj;
        req.locals.query.$or = [];
        Object.keys(paths).forEach((name) => {
          if (paths[name].query) {
            req.locals.query.$or.push({ [name]: new RegExp(kw, 'igm') });
          }
        });
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
          .count(query)
          .exec((err, total) => {
            if (err) return next(err);

            model
              .find(query)
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

        const object = new Model(_object);
        object.save((err) => {
          if (err) return next(err);

          res.sendStatus(201);
        });
      },

      retrieve(Models, { req, res, next }) {
        const { id } = req.params;
        const { select = {} } = req.locals;

        Models[namespace]
          .findOne({ _id: id })
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
          .findOne({ _id: id })
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
          .remove({ _id: id })
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
        // delete: del.concat(['locals', 'delete']),
      },
    },
  };
};
