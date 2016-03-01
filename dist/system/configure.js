System.register([], function (_export) {
    'use strict';

    var Configure;

    var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

    return {
        setters: [],
        execute: function () {
            Configure = (function () {
                function Configure() {
                    _classCallCheck(this, Configure);

                    this._config = {
                        apiScript: 'https://maps.googleapis.com/maps/api/js',
                        apiKey: ''
                    };
                }

                _createClass(Configure, [{
                    key: 'options',
                    value: function options(obj) {
                        Object.assign(this._config, obj);
                    }
                }, {
                    key: 'get',
                    value: function get(key) {
                        return this._config[key];
                    }
                }, {
                    key: 'set',
                    value: function set(key, val) {
                        this._config[key] = val;
                        return this._config[key];
                    }
                }]);

                return Configure;
            })();

            _export('Configure', Configure);
        }
    };
});