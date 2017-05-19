import { symbol, isSymbol } from './util.js';
import { _tag } from './symbols.js';
import Transaction, { record } from './transaction.js';
import notify from './notify.js';
import Reflect from './reflect.js';

function isArraySet(object, property){
  return Array.isArray(object) && !isNaN(+property);
}

function isArraySet2(object, property){
  return Array.isArray(object) && 
    !isNaN(+(isSymbol(property) ? 'm' : property));
}

function isArrayOrObject(object) {
  return Array.isArray(object) || typeof object === 'object';
}

function observe(o, fn) {
  var proxy = new Proxy(o, {
    get: function(target, property) {
      Transaction.observe(proxy, property);
      return target[property];
    },
    set: function(target, property, value) {
      var oldValue = target[property];
      if(!isModel(value) && isArrayOrObject(value)) {
        value = toModel(value);
      }
      target[property] = value;

      // If the value hasn't changed, nothing else to do
      if(value === oldValue)
        return true;

      if(isArraySet(target, property)) {
        fn({
          prop: arrayChange,
          index: +property,
          type: 'set'
        }, value);
      } else {
        fn({
          prop: property,
          type: 'set'
        }, value)
      }

      return true;
    },
    deleteProperty: function(target, property, value){
      if(isArraySet(target, property)) {
        fn({
          prop: arrayChange,
          index: +property,
          type: 'delete'
        });
      }

      return true;
    }
  });
  return proxy;
}

var events = symbol('bram-events');

var toModel = function(o, skipClone){
  if(isModel(o)) return o;

  o = deepModel(o, skipClone) || {};

  var callback = function(ev, value){
    var fns = o[events][ev.prop];
    if(fns) {
      fns.forEach(function(fn){
        fn(ev, value);
      });
    }
  };

  Object.defineProperty(o, events, {
    value: {},
    enumerable: false
  });

  return observe(o, callback);
};

function deepModel(o, skipClone) {
  return !o ? o : Object.keys(o).reduce(function(acc, prop){
    var val = o[prop];
    acc[prop] = (Array.isArray(val) || typeof val === 'object')
      ? toModel(val)
      : val;
    return acc;
  }, o);
}

var isModel = function(object){
  return object && !!object[events];
};

var on = function(model, prop, callback){
  var evs = model[events];
  if(!evs) return;
  var ev = evs[prop];
  if(!ev) {
    ev = evs[prop] = [];
  }
  ev.push(callback);
};

var off = function(model, prop, callback){
  var evs = model[events];
  if(!evs) return;
  var ev = evs[prop];
  if(!ev) return;
  var idx = ev.indexOf(callback);
  if(idx === -1) return;
  ev.splice(idx, 1);
  if(!ev.length) {
    delete evs[prop];
  }
};

var arrayChanges = new Map();

toModel = function(o, skipClone){
  var m = new Proxy(deepModel(o, skipClone), {
    get: function(target, property){
      record(m, property);
      return Reflect.get(target, property, m); 
    },
    set: function(target, property, value){
      target[property] = value;

      if(property === _tag) {
        return true;
      }

      notify(m, property);
      return true;
    },
    deleteProperty(target, property){
      delete target[property];
      notify(m, property);
      return true;
    }
  });

  return m;
};

const arrayChange = symbol('bram-array-change');

export {
  arrayChange,
  arrayChanges,
  on,
  off,
  isModel,
  toModel
};
