'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/**
 * @Author: eason
 * @Date:   2017-07-09T14:47:00+08:00
 * @Last modified by:   eason
 * @Last modified time: 2017-07-09T19:03:38+08:00
 */
module.exports = function createPlugin(route, namespace, schema) {
  var _routes;

  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var _options$many = options.many,
      many = _options$many === undefined ? {} : _options$many,
      _options$one = options.one,
      one = _options$one === undefined ? {} : _options$one;
  var _many$list = many.list,
      list = _many$list === undefined ? [] : _many$list,
      _many$create = many.create,
      create = _many$create === undefined ? [] : _many$create;
  var _one$retrieve = one.retrieve,
      retrieve = _one$retrieve === undefined ? [] : _one$retrieve,
      _one$update = one.update,
      update = _one$update === undefined ? [] : _one$update,
      _one$del = one.del,
      del = _one$del === undefined ? [] : _one$del; // eslint-disable-line

  return {
    namespace: namespace,

    models: {
      schema: _extends({}, schema, {
        owner: { type: 'ObjectId', ref: 'User' }
      }),
      options: {
        timestamps: true,
        safe: true,
        strict: true,
        toJSON: { virtuals: false },
        versionKey: false
      }
    },

    middlewares: {
      'locals': function locals(Model, _ref) {
        var req = _ref.req,
            next = _ref.next;

        req.locals = {
          query: {},
          select: {},
          sort: {}
        };
        next();
      },
      'format/offset&limit': function formatOffsetLimit(Model, _ref2) {
        var req = _ref2.req,
            next = _ref2.next;

        req.locals.offset = +req.query.offset || 0;
        req.locals.limit = +req.query.limit || 10;
        next();
      },
      'format/sort': function formatSort(Model, _ref3) {
        var req = _ref3.req,
            next = _ref3.next;

        if (Array.isArray(req.query.sort)) {
          req.locals.sort = req.query.sort.reduce(function (a, b) {
            var _ref4 = b.indexOf('-') !== -1 ? { sort: -1, name: b.slice(1) } : { sort: 1, name: b },
                sort = _ref4.sort,
                name = _ref4.name;

            return _extends(a, _defineProperty({}, name, sort));
          }, {});
        } else if (typeof req.query.sort === 'string') {
          var _ref5 = req.query.sort.indexOf('-') !== -1 ? { sort: -1, name: req.query.sort.slice(1) } : { sort: 1, name: req.query.sort },
              sort = _ref5.sort,
              name = _ref5.name;

          req.locals.sort = _defineProperty({}, name, sort);
        }
        next();
      },
      'format/search': function formatSearch(Models, _ref6) {
        var req = _ref6.req,
            next = _ref6.next;

        var _req$query = req.query,
            k = _req$query.k,
            s = _req$query.s,
            keywords = _req$query.keywords,
            sort = _req$query.sort,
            offset = _req$query.offset,
            limit = _req$query.limit,
            others = _objectWithoutProperties(_req$query, ['k', 's', 'keywords', 'sort', 'offset', 'limit']);

        var kw = k || s || keywords;
        var paths = Models[namespace].schema.obj;
        req.locals.query.$and = [];
        [].concat(_toConsumableArray(Object.keys(paths)), ['createdAt', 'updatedAt']).forEach(function (name) {
          if (['createdAt', 'updatedAt'].indexOf(name) !== -1 || paths[name].query) {
            // fuzzy search
            if (kw) {
              req.locals.query.$and.push(_defineProperty({}, name, new RegExp(kw, 'igm')));
            }

            // exact search
            if (Object.keys(others).indexOf(name) !== -1) {
              var range = ('' + others[name]).split('-');

              // 1 range search
              if (range.length === 2 && !!range[1]) {
                // const [gte, lt] = [new Date(range[0]), new Date(range[1])];

                // 1.1 date range
                // if (gte.getFullYear() > 1024 & lt.getFullYear() > 1024) {
                //  req.locals.query.$and.push({ [name]: { $gte: gte, $lt: lt } });
                //} else {
                req.locals.query.$and.push(_defineProperty({}, name, { $gte: range[0], $lt: range[1] }));
                //}
              } else {
                if (Array.isArray(others[name])) {
                  // support value not equal @2: nin
                  var $in = [];
                  var $nin = [];
                  var _iteratorNormalCompletion = true;
                  var _didIteratorError = false;
                  var _iteratorError = undefined;

                  try {
                    for (var _iterator = others[name][Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                      var v = _step.value;

                      if (typeof v === 'string' && v[0] === '!') {
                        $nin.push(v);
                      } else {
                        $in.push(v);
                      }
                    }
                  } catch (err) {
                    _didIteratorError = true;
                    _iteratorError = err;
                  } finally {
                    try {
                      if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                      }
                    } finally {
                      if (_didIteratorError) {
                        throw _iteratorError;
                      }
                    }
                  }

                  var conditions = {};
                  if ($in.length > 0) {
                    conditions.$in = $in;
                  }

                  if ($nin.length > 0) {
                    conditions.$nin = $nin;
                  }

                  req.locals.query.$and.push(_defineProperty({}, name, conditions));
                } else if (['true', 'false', ''].includes(others[name])) {
                  req.locals.query.$and.push(_defineProperty({}, name, ['true', ''].includes(others[name]) ? true : false));
                } else {
                  // support value not equal @1: ne
                  if (others[name][0] === '!') {
                    req.locals.query.$and.push(_defineProperty({}, name, { $ne: others[name] }));
                  } else {
                    req.locals.query.$and.push(_defineProperty({}, name, others[name]));
                  }
                }
              }
            } else {
              // @TODO
              for (var key in others) {
                //  support a.b = c, and begin with a
                if (key.indexOf(name) === 0) {
                  var _v = others[key];
                  if (Array.isArray(_v)) {
                    req.locals.query.$and.push(_defineProperty({}, key, { $in: _v }));
                  } else {
                    if (['true', 'false', ''].includes(_v)) {
                      req.locals.query.$and.push(_defineProperty({}, key, ['true', ''].includes(_v) ? true : false));
                    } else {
                      req.locals.query.$and.push(_defineProperty({}, key, _v));
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
      }
    },

    handlers: {
      list: function list(Model, _ref7) {
        var req = _ref7.req,
            res = _ref7.res,
            next = _ref7.next;
        var _req$locals = req.locals,
            _req$locals$offset = _req$locals.offset,
            offset = _req$locals$offset === undefined ? 0 : _req$locals$offset,
            _req$locals$limit = _req$locals.limit,
            limit = _req$locals$limit === undefined ? 10 : _req$locals$limit,
            _req$locals$query = _req$locals.query,
            query = _req$locals$query === undefined ? {} : _req$locals$query,
            _req$locals$sort2 = _req$locals.sort,
            sort = _req$locals$sort2 === undefined ? {} : _req$locals$sort2,
            _req$locals$select = _req$locals.select,
            select = _req$locals$select === undefined ? {} : _req$locals$select;

        var model = Model[namespace];

        model.count(_extends({}, query, req.user ? { owner: req.user } : {})).exec(function (err, total) {
          if (err) return next(err);

          model.find(_extends({}, query, req.user ? { owner: req.user } : {})).sort(sort).skip(offset).limit(limit).select(select).lean().exec(function (error, data) {
            if (error) return next(err);

            var realCount = data.length;

            return res.status(200).json({
              offset: offset,
              count: realCount,
              total: total,
              data: data
            });
          });
        });
      },
      create: function create(Models, _ref8) {
        var req = _ref8.req,
            res = _ref8.res,
            next = _ref8.next;

        var Model = Models[namespace];
        var paths = Model.schema.obj;
        var _object = {};
        var _raw = req.body;

        Object.keys(_raw).forEach(function (key) {
          if (paths.hasOwnProperty(key)) {
            // eslint-disable-line
            _extends(_object, _defineProperty({}, key, _raw[key]));
          }
        });

        var object = new Model(_extends(_object, req.user ? { owner: req.user } : {}));
        object.save(function (err) {
          if (err) return next(err);

          res.sendStatus(201);
        });
      },
      retrieve: function retrieve(Models, _ref9) {
        var req = _ref9.req,
            res = _ref9.res,
            next = _ref9.next;
        var id = req.params.id;
        var _req$locals$select2 = req.locals.select,
            select = _req$locals$select2 === undefined ? {} : _req$locals$select2;


        Models[namespace].findOne(_extends({ _id: id }, req.user ? { owner: req.user } : {})).select(select).exec(function (err, object) {
          if (err) return next(err);

          res.status(200).json(object);
        });
      },
      update: function update(Models, _ref10) {
        var req = _ref10.req,
            res = _ref10.res,
            next = _ref10.next;
        var id = req.params.id;

        var Model = Models[namespace];
        var paths = Model.schema;

        Model.findOne(_extends({ _id: id }, req.user ? { owner: req.user } : {})).exec(function (err, object) {
          if (err) return next(err);

          var _raw = req.body;
          var _object = {};
          Object.keys(_raw).forEach(function (key) {
            if (paths.hasOwnProperty(key)) {
              // eslint-disable-line
              _extends(_object, _defineProperty({}, key, _raw[key]));
            }
          });

          object.update(_object, function (error) {
            // eslint-disable-line
            return error ? next(error) : res.json(_object);
          });
        });
      },
      delete: function _delete(Models, _ref11) {
        var req = _ref11.req,
            res = _ref11.res,
            next = _ref11.next;
        var id = req.params.id;


        return Models[namespace].remove(_extends({ _id: id }, req.user ? { owner: req.user } : {})).exec(function (error) {
          return error ? next(error) : res.sendStatus(204);
        });
      }
    },

    routes: (_routes = {}, _defineProperty(_routes, route, {
      get: list.concat(['locals', 'format/offset&limit', 'format/search', 'format/sort', 'list']),
      post: create.concat(['locals', 'create'])
    }), _defineProperty(_routes, route + '/:id', {
      get: retrieve.concat(['locals', 'retrieve']),
      put: update.concat(['locals', 'update']),
      delete: del.concat(['locals', 'delete'])
    }), _routes)
  };
};