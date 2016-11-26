var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { inject } from 'aurelia-dependency-injection';
import { bindable, customElement } from 'aurelia-templating';
import { TaskQueue } from 'aurelia-task-queue';
import { BindingEngine } from 'aurelia-binding';
import { EventAggregator } from 'aurelia-event-aggregator';
import { Configure } from './configure';
const GM = 'googlemap';
const BOUNDSCHANGED = `${GM}:bounds_changed`;
const CLICK = `${GM}:click`;
const INFOWINDOWDOMREADY = `${GM}:infowindow:domready`;
const MARKERCLICK = `${GM}:marker:click`;
const MARKERMOUSEOVER = `${GM}:marker:mouse_over`;
const MARKERMOUSEOUT = `${GM}:marker:mouse_out`;
const APILOADED = `${GM}:api:loaded`;
const randomColor = ['#8c8840', '#ebbfef', '#634b8c', '#591177', '#57bf81', '#26130b', '#ea54d1', '#db27c9', '#e84797', '#092b11', '#545246', '#3e3d3f', '#191c14', '#340742', '#4b97a8', '#6b374e', '#773329', '#a872a5', '#2f332a', '#332d24', '#301805', '#a797c1', '#000000', '#5364d6', '#afc13a', '#5b024b', '#ef7970', '#0b0c01', '#27284c', '#131c19', '#65d3d1', '#372a68', '#b756aa', '#b87abf', '#83179b', '#3a3a3a', '#e0fff6', '#47917e', '#7f8687', '#ad4a5f', '#993d5b', '#70aef9', '#a84a87', '#193842', '#bab07c', '#a35a08', '#aab599', '#751c66', '#5b4b05', '#a57d8b', '#2c302c', '#11353d', '#01381b', '#544447', '#af5b98', '#7aa1bc', '#8f9e90', '#46a067', '#444945', '#b24961', '#093a07', '#a8af8c', '#3c4154', '#000f42', '#555630', '#492e33', '#061f82', '#464149', '#3f5437', '#473151', '#8e66ff', '#635a04', '#140610', '#6d7544', '#543d89', '#b59482', '#a59098', '#b79a50', '#3d03a3', '#5b2425', '#8b9d9e', '#141008', '#f26310', '#405930', '#1e1a0e', '#fcbdd8', '#a6a0bf', '#7f572a', '#aaaa86', '#59271b', '#7c681c', '#010202', '#a0ced8', '#5d8c85', '#365135', '#49333b', '#182a3d', '#e87e78', '#000000', '#08373f'];
export let GoogleMaps = class GoogleMaps {
    constructor(element, taskQueue, config, bindingEngine, eventAggregator) {
        this._DEFAULT_ADDRESS = null;
        this._DEFAULT_LONGITUDE = 0;
        this._DEFAULT_LATITUDE = 0;
        this._DEFAULT_ZOOM = 8;
        this._DEFAULT_MARKERS = [];
        this.address = this._DEFAULT_ADDRESS;
        this.longitude = this._DEFAULT_LONGITUDE;
        this.latitude = this._DEFAULT_LATITUDE;
        this.zoom = this._DEFAULT_ZOOM;
        this.disableDefaultUI = false;
        this.markers = this._DEFAULT_MARKERS;
        this.autoUpdateBounds = false;
        this.mapType = 'ROADMAP';
        this.loadMapApiScript = true;
        this.drawConnectMarkerLines = false;
        this.map = null;
        this._renderedMarkers = [];
        this._markersSubscription = null;
        this._scriptPromise = null;
        this._mapPromise = null;
        this._mapResolve = null;
        this._locationByAddressMarkers = [];
        this.element = element;
        this.taskQueue = taskQueue;
        this.config = config;
        this.bindingEngine = bindingEngine;
        this.eventAggregator = eventAggregator;
        if (!config.get('apiScript')) {
            console.error('No API script is defined.');
        }
        if (!config.get('apiKey')) {
            console.error('No API key has been specified.');
        }
        let self = this;
        this.eventAggregator.subscribe('startMarkerHighlight', function (data) {
            let mrkr = self._renderedMarkers[data.index];
            mrkr.setIcon(mrkr.custom.altIcon);
            mrkr.setZIndex(window.google.maps.Marker.MAX_ZINDEX + 1);
        });
        this.eventAggregator.subscribe('stopMarkerHighLight', function (data) {
            let mrkr = self._renderedMarkers[data.index];
            mrkr.setIcon(mrkr.custom.defaultIcon);
        });
        this.eventAggregator.subscribe('panToMarker', function (data) {
            self.map.panTo(self._renderedMarkers[data.index].position);
            self.map.setZoom(17);
        });
        this.eventAggregator.subscribe(`${GM}:clear:marker`, data => {
            this._clearMarkers();
        });
    }
    bind() {
        if (this.loadMapApiScript === "false") {
            this.loadMapApiScript = false;
        }
        if (this.loadMapApiScript) {
            this.loadApiScript();
        }
        else {
            this._scriptPromise = new Promise((resolve, reject) => {
                const RETRY_CHECKED_LOADED_API_COUNT = 20;
                let checkCount = 1;
                let it = setInterval(() => {
                    checkCount++;
                    if (window.google && window.google.maps) {
                        clearInterval(it);
                        resolve();
                    }
                    if (checkCount > RETRY_CHECKED_LOADED_API_COUNT) {
                        clearInterval(it);
                    }
                }, 1000);
            });
        }
        let self = this;
        this._mapPromise = this._scriptPromise.then(() => {
            return new Promise((resolve, reject) => {
                self._mapResolve = resolve;
                this._triggerPropertyChangedHandler();
            });
        });
    }
    _triggerPropertyChangedHandler() {
        if (this.address !== this._DEFAULT_ADDRESS) {
            this.addressChanged(this.address);
        }
        if (this.longitude !== this._DEFAULT_LONGITUDE) {
            this.longitudeChanged(this.longitude);
        }
        if (this.latitude !== this._DEFAULT_LATITUDE) {
            this.latitudeChanged(this.latitude);
        }
        if (this.zoom !== this._DEFAULT_ZOOM) {
            this.zoomChanged(this.zoom);
        }
        if (this.markers && this.markers.length !== this._DEFAULT_MARKERS.length) {
            this.markersChanged(this.markers);
        }
    }
    _clearMarkers() {
        if (!this._locationByAddressMarkers || !this._renderedMarkers) {
            return;
        }
        this._locationByAddressMarkers.concat(this._renderedMarkers).forEach(marker => {
            marker.setMap(null);
        });
        this._locationByAddressMarkers = [];
        this._renderedMarkers = [];
    }
    attached() {
        this.element.addEventListener('dragstart', evt => {
            evt.preventDefault();
        });
        this.element.addEventListener("zoom_to_bounds", evt => {
            this.zoomToMarkerBounds();
        });
        this._scriptPromise.then(() => {
            let latLng = new window.google.maps.LatLng(parseFloat(this.latitude), parseFloat(this.longitude));
            let mapTypeId = this.getMapTypeId();
            let options = Object.assign(this.config.get('options'), {
                center: latLng,
                zoom: parseInt(this.zoom, 10),
                disableDefaultUI: this.disableDefaultUI,
                mapTypeId: mapTypeId
            });
            this.map = new window.google.maps.Map(this.element, options);
            this._mapResolve();
            this.map.addListener('click', (e) => {
                let changeEvent;
                if (window.CustomEvent) {
                    changeEvent = new CustomEvent('map-click', {
                        detail: e,
                        bubbles: true
                    });
                }
                else {
                    changeEvent = document.createEvent('CustomEvent');
                    changeEvent.initCustomEvent('map-click', true, true, { data: e });
                }
                this.element.dispatchEvent(changeEvent);
                this.eventAggregator.publish(CLICK, e);
            });
            this.map.addListener('dragend', () => {
                this.sendBoundsEvent();
            });
            this.map.addListener('zoom_changed', () => {
                this.sendBoundsEvent();
            });
        });
    }
    sendBoundsEvent() {
        let bounds = this.map.getBounds();
        if (bounds) {
            this.eventAggregator.publish(BOUNDSCHANGED, bounds);
        }
    }
    sendApiLoadedEvent() {
        this.eventAggregator.publish(APILOADED, this._scriptPromise);
    }
    renderMarker(marker) {
        let markerLatLng = new window.google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude));
        this._mapPromise.then(() => {
            let mapMarker = {
                map: this.map,
                position: markerLatLng
            };
            if (!!marker.label) {
                mapMarker['label'] = String(marker.label);
            }
            this.createMarker(mapMarker).then(createdMarker => {
                createdMarker.addListener('click', () => {
                    if (!createdMarker.infoWindow) {
                        this.eventAggregator.publish(MARKERCLICK, createdMarker);
                    }
                    else {
                        createdMarker.infoWindow.open(this.map, createdMarker);
                    }
                });
                createdMarker.addListener('mouseover', () => {
                    this.eventAggregator.publish(MARKERMOUSEOVER, createdMarker);
                    createdMarker.setZIndex(window.google.maps.Marker.MAX_ZINDEX + 1);
                });
                createdMarker.addListener('mouseout', () => {
                    this.eventAggregator.publish(MARKERMOUSEOUT, createdMarker);
                });
                createdMarker.addListener('dblclick', () => {
                    this.map.setZoom(15);
                    this.map.panTo(createdMarker.position);
                });
                if (marker.icon) {
                    createdMarker.setIcon(marker.icon);
                }
                if (marker.label) {
                    createdMarker.setLabel(marker.label);
                }
                if (marker.title) {
                    createdMarker.setTitle(marker.title);
                }
                if (marker.infoWindow) {
                    createdMarker.infoWindow = new window.google.maps.InfoWindow({
                        content: marker.infoWindow.content,
                        pixelOffset: marker.infoWindow.pixelOffset,
                        position: marker.infoWindow.position,
                        maxWidth: marker.infoWindow.maxWidth
                    });
                    createdMarker.infoWindow.addListener('domready', () => {
                        this.eventAggregator.publish(INFOWINDOWDOMREADY, createdMarker.infoWindow);
                    });
                }
                if (marker.custom) {
                    createdMarker.custom = marker.custom;
                }
                this._renderedMarkers.push(createdMarker);
            });
        });
    }
    geocodeAddress(address, geocoder) {
        this._mapPromise.then(() => {
            geocoder.geocode({ 'address': address }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK) {
                    this._clearMarkers();
                    let firstResultLocation = results[0].geometry.location;
                    this.setCenter(firstResultLocation);
                    this.createMarker({
                        map: this.map,
                        position: firstResultLocation
                    }).then(createdMarker => this._locationByAddressMarkers.push(createdMarker));
                    this.eventAggregator.publish(`${GM}:address-search:result`, firstResultLocation);
                }
            });
        });
    }
    getCurrentPosition() {
        if (navigator.geolocation) {
            return navigator.geolocation.getCurrentPosition(position => Promise.resolve(position), evt => Promise.reject(evt));
        }
        return Promise.reject('Browser Geolocation not supported or found.');
    }
    loadApiScript() {
        if (this._scriptPromise) {
            return this._scriptPromise;
        }
        if (window.google === undefined || window.google.maps === undefined) {
            let script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.defer = true;
            script.src = `${this.config.get('apiScript')}?key=${this.config.get('apiKey')}&libraries=${this.config.get('apiLibraries')}&callback=myGoogleMapsCallback`;
            document.body.appendChild(script);
            this._scriptPromise = new Promise((resolve, reject) => {
                window.myGoogleMapsCallback = () => {
                    this.sendApiLoadedEvent();
                    resolve();
                };
                script.onerror = error => {
                    reject(error);
                };
            });
            return this._scriptPromise;
        }
        if (window.google && window.google.maps) {
            this._scriptPromise = new Promise(resolve => { resolve(); });
            return this._scriptPromise;
        }
        return false;
    }
    setOptions(options) {
        if (!this.map) {
            return;
        }
        this.map.setOptions(options);
    }
    createMarker(options) {
        return this._scriptPromise.then(() => {
            return Promise.resolve(new window.google.maps.Marker(options));
        });
    }
    getCenter() {
        this._mapPromise.then(() => {
            return Promise.resolve(this.map.getCenter());
        });
    }
    setCenter(latLong) {
        this._mapPromise.then(() => {
            this.map.setCenter(latLong);
            this.sendBoundsEvent();
        });
    }
    updateCenter() {
        this._mapPromise.then(() => {
            let latLng = new window.google.maps.LatLng(parseFloat(this.latitude), parseFloat(this.longitude));
            this.setCenter(latLng);
        });
    }
    addressChanged(newValue) {
        this._mapPromise.then(() => {
            let geocoder = new window.google.maps.Geocoder;
            this.taskQueue.queueMicroTask(() => {
                this.geocodeAddress(newValue, geocoder);
            });
        });
    }
    latitudeChanged(newValue) {
        this._mapPromise.then(() => {
            this.taskQueue.queueMicroTask(() => {
                this.updateCenter();
            });
        });
    }
    longitudeChanged(newValue) {
        this._mapPromise.then(() => {
            this.taskQueue.queueMicroTask(() => {
                this.updateCenter();
            });
        });
    }
    zoomChanged(newValue) {
        this._mapPromise.then(() => {
            this.taskQueue.queueMicroTask(() => {
                let zoomValue = parseInt(newValue, 10);
                this.map.setZoom(zoomValue);
            });
        });
    }
    markersChanged(newValue) {
        if (this._markersSubscription !== null) {
            this._markersSubscription.dispose();
            for (let marker of this._renderedMarkers) {
                marker.setMap(null);
            }
            this._renderedMarkers = [];
        }
        this._markersSubscription = this.bindingEngine
            .collectionObserver(this.markers)
            .subscribe((splices) => { this.markerCollectionChange(splices); });
        this._mapPromise.then(() => {
            for (let marker of newValue) {
                this.renderMarker(marker);
            }
            if (this.drawConnectMarkerLines && newValue.length > 1) {
                this._drawConnectMarkerLines(newValue);
            }
        });
        this.zoomToMarkerBounds();
    }
    _drawConnectMarkerLines(markers) {
        for (let i = 1; i < markers.length; i++) {
            let firstPoint = { lat: markers[i - 1].latitude, lng: markers[i - 1].longitude };
            let secondPoint = { lat: markers[i].latitude, lng: markers[i].longitude };
            let flightPath = new window.google.maps.Polyline({
                path: [firstPoint, secondPoint],
                geodesic: true,
                strokeColor: randomColor[this._getRandomInt(0, 99)],
                strokeOpacity: 1.0,
                strokeWeight: 2
            });
            flightPath.setMap(this.map);
        }
    }
    _getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    markerCollectionChange(splices) {
        if (!splices.length) {
            return;
        }
        for (let splice of splices) {
            if (splice.removed.length) {
                for (let removedObj of splice.removed) {
                    for (let markerIndex in this._renderedMarkers) {
                        if (this._renderedMarkers.hasOwnProperty(markerIndex)) {
                            let renderedMarker = this._renderedMarkers[markerIndex];
                            if (renderedMarker.position.lat().toFixed(12) === removedObj.latitude.toFixed(12) &&
                                renderedMarker.position.lng().toFixed(12) === removedObj.longitude.toFixed(12)) {
                                renderedMarker.setMap(null);
                                this._renderedMarkers.splice(markerIndex, 1);
                                break;
                            }
                        }
                    }
                }
            }
            if (splice.addedCount) {
                let addedMarker = this.markers[splice.index];
                this.renderMarker(addedMarker);
            }
        }
        this.zoomToMarkerBounds();
    }
    zoomToMarkerBounds() {
        if (this.autoUpdateBounds) {
            let self = this;
            this._mapPromise.then(() => {
                if (this.markers.length === 1) {
                    window.google.maps.event.addListenerOnce(this.map, 'bounds_changed', function (event) {
                        this.setZoom(typeof self.zoom === 'number' ? self.zoom : parseInt(self.zoom));
                    });
                }
                let bounds = new window.google.maps.LatLngBounds();
                for (let marker of this.markers) {
                    let markerLatLng = new window.google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude));
                    bounds.extend(markerLatLng);
                }
                this.map.fitBounds(bounds);
            });
        }
    }
    getMapTypeId() {
        if (this.mapType.toUpperCase() === 'HYBRID') {
            return window.google.maps.MapTypeId.HYBRID;
        }
        else if (this.mapType.toUpperCase() === 'SATELLITE') {
            return window.google.maps.MapTypeId.SATELLITE;
        }
        else if (this.mapType.toUpperCase() === 'TERRAIN') {
            return window.google.maps.MapTypeId.TERRAIN;
        }
        return window.google.maps.MapTypeId.ROADMAP;
    }
    error() {
        console.error.apply(console, arguments);
    }
};
__decorate([
    bindable, 
    __metadata('design:type', Object)
], GoogleMaps.prototype, "address", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Number)
], GoogleMaps.prototype, "longitude", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Number)
], GoogleMaps.prototype, "latitude", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Number)
], GoogleMaps.prototype, "zoom", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Boolean)
], GoogleMaps.prototype, "disableDefaultUI", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Object)
], GoogleMaps.prototype, "markers", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Boolean)
], GoogleMaps.prototype, "autoUpdateBounds", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Object)
], GoogleMaps.prototype, "mapType", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Object)
], GoogleMaps.prototype, "loadMapApiScript", void 0);
__decorate([
    bindable, 
    __metadata('design:type', Boolean)
], GoogleMaps.prototype, "drawConnectMarkerLines", void 0);
GoogleMaps = __decorate([
    customElement('google-map'),
    inject(Element, TaskQueue, Configure, BindingEngine, EventAggregator), 
    __metadata('design:paramtypes', [Object, Object, Object, Object, Object])
], GoogleMaps);
//# sourceMappingURL=google-maps.js.map