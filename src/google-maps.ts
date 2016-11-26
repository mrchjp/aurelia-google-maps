import {inject} from 'aurelia-dependency-injection';
import {bindable, customElement} from 'aurelia-templating';
import {TaskQueue} from 'aurelia-task-queue';
import {BindingEngine} from 'aurelia-binding';
import {EventAggregator} from 'aurelia-event-aggregator';

import {Configure} from './configure';

// use constants to guard against typos
const GM = 'googlemap';
const BOUNDSCHANGED = `${GM}:bounds_changed`;
const CLICK = `${GM}:click`;
const INFOWINDOWDOMREADY = `${GM}:infowindow:domready`;
const MARKERCLICK = `${GM}:marker:click`;
//const MARKERDOUBLECLICK = `${GM}:marker:dblclick`;
const MARKERMOUSEOVER = `${GM}:marker:mouse_over`;
const MARKERMOUSEOUT = `${GM}:marker:mouse_out`;
const APILOADED = `${GM}:api:loaded`;

const randomColor = ['#8c8840', '#ebbfef', '#634b8c', '#591177', '#57bf81', '#26130b', '#ea54d1', '#db27c9', '#e84797', '#092b11', '#545246', '#3e3d3f', '#191c14', '#340742', '#4b97a8', '#6b374e', '#773329', '#a872a5', '#2f332a', '#332d24', '#301805', '#a797c1', '#000000', '#5364d6', '#afc13a', '#5b024b', '#ef7970', '#0b0c01', '#27284c', '#131c19', '#65d3d1', '#372a68', '#b756aa', '#b87abf', '#83179b', '#3a3a3a', '#e0fff6', '#47917e', '#7f8687', '#ad4a5f', '#993d5b', '#70aef9', '#a84a87', '#193842', '#bab07c', '#a35a08', '#aab599', '#751c66', '#5b4b05', '#a57d8b', '#2c302c', '#11353d', '#01381b', '#544447', '#af5b98', '#7aa1bc', '#8f9e90', '#46a067', '#444945', '#b24961', '#093a07', '#a8af8c', '#3c4154', '#000f42', '#555630', '#492e33', '#061f82', '#464149', '#3f5437', '#473151', '#8e66ff', '#635a04', '#140610', '#6d7544', '#543d89', '#b59482', '#a59098', '#b79a50', '#3d03a3', '#5b2425', '#8b9d9e', '#141008', '#f26310', '#405930', '#1e1a0e', '#fcbdd8', '#a6a0bf', '#7f572a', '#aaaa86', '#59271b', '#7c681c', '#010202', '#a0ced8', '#5d8c85', '#365135', '#49333b', '#182a3d', '#e87e78', '#000000', '#08373f'];

@customElement('google-map')
@inject(Element, TaskQueue, Configure, BindingEngine, EventAggregator)
export class GoogleMaps {
    private element: Element;
    private taskQueue: TaskQueue;
    private config;
    private bindingEngine: BindingEngine;
    private eventAggregator: EventAggregator;

    _DEFAULT_ADDRESS = null;
    _DEFAULT_LONGITUDE = 0;
    _DEFAULT_LATITUDE = 0;
    _DEFAULT_ZOOM = 8;
    _DEFAULT_MARKERS = [];

    @bindable address = this._DEFAULT_ADDRESS;
    @bindable longitude: number = this._DEFAULT_LONGITUDE;
    @bindable latitude: number = this._DEFAULT_LATITUDE;
    @bindable zoom: number = this._DEFAULT_ZOOM;
    @bindable disableDefaultUI: boolean = false;
    @bindable markers = this._DEFAULT_MARKERS;
    @bindable autoUpdateBounds: boolean = false;
    @bindable mapType = 'ROADMAP';
    @bindable loadMapApiScript = true;
    @bindable drawConnectMarkerLines:boolean = false;

    map = null;
    _renderedMarkers = [];
    _markersSubscription = null;
    _scriptPromise = null;
    _mapPromise = null;
    _mapResolve = null;
    _locationByAddressMarkers = [];

    constructor(element, taskQueue, config, bindingEngine, eventAggregator) {
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
        this.eventAggregator.subscribe('startMarkerHighlight', function(data) {
            let mrkr = self._renderedMarkers[data.index];
            mrkr.setIcon(mrkr.custom.altIcon);
            mrkr.setZIndex((<any>window).google.maps.Marker.MAX_ZINDEX + 1);
        });

        this.eventAggregator.subscribe('stopMarkerHighLight', function(data) {
            let mrkr = self._renderedMarkers[data.index];
            mrkr.setIcon( mrkr.custom.defaultIcon);
        });

        this.eventAggregator.subscribe('panToMarker', function(data) {
            self.map.panTo(self._renderedMarkers[data.index].position);
            self.map.setZoom(17);
        });

        this.eventAggregator.subscribe(`${GM}:clear:marker`, data => {
            this._clearMarkers();
        });
    }

    bind() {
        if ((<string><any>this.loadMapApiScript) === "false") {
            this.loadMapApiScript = false;
        }
        if (this.loadMapApiScript) {
            this.loadApiScript();
        } else {
            this._scriptPromise = new Promise((resolve, reject) => {
                const RETRY_CHECKED_LOADED_API_COUNT = 20;
                let checkCount = 1;
                let it = setInterval(() => {
                    checkCount++;
                    if ((<any>window).google && (<any>window).google.maps) {
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
                // Register the the resolve method for _mapPromise
                self._mapResolve = resolve;
                this._triggerPropertyChangedHandler();
            });
        });
    }

    /**
     * when bind callback is called, {property}Changed callback handler will not be called in first time. 
     */
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
            let latLng = new (<any>window).google.maps.LatLng(parseFloat((<any>this.latitude)), parseFloat((<any>this.longitude)));
            let mapTypeId = this.getMapTypeId();

            let options: any = Object.assign(this.config.get('options'), {
                center: latLng,
                zoom: parseInt((<any>this.zoom), 10),
                disableDefaultUI: this.disableDefaultUI,
                mapTypeId: mapTypeId
            });

            this.map = new (<any>window).google.maps.Map(this.element, options);
            this._mapResolve();

            // Add event listener for click event
            this.map.addListener('click', (e) => {
                let changeEvent;
                if ((<any>window).CustomEvent) {
                    changeEvent = new CustomEvent('map-click', {
                        detail: e,
                        bubbles: true
                    });
                } else {
                    changeEvent = document.createEvent('CustomEvent');
                    changeEvent.initCustomEvent('map-click', true, true, { data: e });
                }

                this.element.dispatchEvent(changeEvent);
                this.eventAggregator.publish(CLICK, e);
            });

            /**
             * As a proxy for the very noisy bounds_changed event, we'll
             * listen to these two instead:
             *
             * dragend */
            this.map.addListener('dragend', () => {
                this.sendBoundsEvent();
            });
            /* zoom_changed */
            this.map.addListener('zoom_changed', () => {
                this.sendBoundsEvent();
            });
        });
    }

    /**
     * Send the map bounds as an EA event
     *
     * The `bounds` object is an instance of `LatLngBounds`
     * See https://developers.google.com/maps/documentation/javascript/reference#LatLngBounds
     */
    sendBoundsEvent() { 
        let bounds = this.map.getBounds();
        if (bounds) {
            this.eventAggregator.publish(BOUNDSCHANGED, bounds);
        }
    }

    /**
     * Send after the api is loaded
     * */
    sendApiLoadedEvent() {
        this.eventAggregator.publish(APILOADED, this._scriptPromise);
    }

    /**
     * Render a marker on the map and add it to collection of rendered markers
     *
     * @param marker
     *
     */
    renderMarker(marker) {
        let markerLatLng = new (<any>window).google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude));

        this._mapPromise.then(() => {
            // Create the marker
            let mapMarker = {
                map: this.map,
                position: markerLatLng
            };
            if (!!marker.label) {
                mapMarker['label'] = String(marker.label);
            }
            this.createMarker(mapMarker).then(createdMarker => {
                /* add event listener for click on the marker,
                 * the event payload is the marker itself */
                createdMarker.addListener('click', () => {
                    if (!createdMarker.infoWindow) {
                        this.eventAggregator.publish(MARKERCLICK, createdMarker);
                    } else {
                        createdMarker.infoWindow.open(this.map, createdMarker);
                    }
                });

                /*add event listener for hover over the marker,
                 *the event payload is the marker itself*/
                createdMarker.addListener('mouseover', () => {
                    this.eventAggregator.publish(MARKERMOUSEOVER, createdMarker);
                    createdMarker.setZIndex((<any>window).google.maps.Marker.MAX_ZINDEX + 1);
                });

                createdMarker.addListener('mouseout', () => {
                    this.eventAggregator.publish(MARKERMOUSEOUT, createdMarker);
                });

                createdMarker.addListener('dblclick', () => {
                    this.map.setZoom(15);
                    this.map.panTo(createdMarker.position);
                });

                // Set some optional marker properties if they exist
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
                    createdMarker.infoWindow = new (<any>window).google.maps.InfoWindow({
                        content: marker.infoWindow.content,
                        pixelOffset: marker.infoWindow.pixelOffset,
                        position: marker.infoWindow.position,
                        maxWidth: marker.infoWindow.maxWidth
                    });
                    createdMarker.infoWindow.addListener('domready', () => {
                        this.eventAggregator.publish(INFOWINDOWDOMREADY, createdMarker.infoWindow);
                    });
                }

                // Allows arbitrary data to be stored on the marker
                if (marker.custom) {
                    createdMarker.custom = marker.custom;
                }

                // Add it the array of rendered markers
                this._renderedMarkers.push(createdMarker);
            });
        });
    }

    /**
     * Geocodes an address, once the Google Map script
     * has been properly loaded and promise instantiated.
     *
     * @param address string
     * @param geocoder any
     *
     */
    geocodeAddress(address, geocoder) {
        this._mapPromise.then(() => {
            geocoder.geocode({'address': address}, (results, status) => {
                if (status === (<any>window).google.maps.GeocoderStatus.OK) {
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

    /**
     * Get Current Position
     *
     * Get the users current coordinate info from their browser
     *
     */
    getCurrentPosition(): any {
        if (navigator.geolocation) {
            return navigator.geolocation.getCurrentPosition(position => Promise.resolve(position), evt => Promise.reject(evt));
        }

        return Promise.reject('Browser Geolocation not supported or found.');
    }

    /**
     * Load API Script
     *
     * Loads the Google Maps Javascript and then resolves a promise
     * if loaded. If Google Maps is already loaded, we just return
     * an immediately resolved promise.
     *
     * @return Promise
     *
     */
    loadApiScript() {
        if (this._scriptPromise) {
            return this._scriptPromise;
        }

        if ((<any>window).google === undefined || (<any>window).google.maps === undefined) {
            // google has not been defined yet
            let script = document.createElement('script');

            script.type = 'text/javascript';
            script.async = true;
            script.defer = true;
            script.src = `${this.config.get('apiScript')}?key=${this.config.get('apiKey')}&libraries=${this.config.get('apiLibraries')}&callback=myGoogleMapsCallback`;
            document.body.appendChild(script);

            this._scriptPromise = new Promise((resolve, reject) => {
                (<any>window).myGoogleMapsCallback = () => {
                    this.sendApiLoadedEvent();
                    resolve();
                };

                script.onerror = error => {
                    reject(error);
                };
            });

            return this._scriptPromise;
        }

        if ((<any>window).google && (<any>window).google.maps) {
            // google has been defined already, so return an immediately resolved Promise that has scope
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
            return Promise.resolve(new (<any>window).google.maps.Marker(options));
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
            let latLng = new (<any>window).google.maps.LatLng(parseFloat((<any>this.latitude)), parseFloat((<any>this.longitude)));
            this.setCenter(latLng);
        });
    }

    addressChanged(newValue) {
        this._mapPromise.then(() => {
            let geocoder = new (<any>window).google.maps.Geocoder;

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

    /**
     * Observing changes in the entire markers object. This is critical in case the user sets marker to a new empty Array,
     * where we need to resubscribe Observers and delete all previously rendered markers.
     *
     * @param newValue
     */
    markersChanged(newValue) {
        // If there was a previous subscription
        if (this._markersSubscription !== null) {
            // Dispose of the subscription
            this._markersSubscription.dispose();

            // Remove all the currently rendered markers
            for (let marker of this._renderedMarkers) {
                marker.setMap(null);
            }

            // And empty the renderMarkers collection
            this._renderedMarkers = [];
        }

        // Add the subcription to markers
        this._markersSubscription = this.bindingEngine
            .collectionObserver(this.markers)
            .subscribe((splices) => { this.markerCollectionChange(splices); });

        // Render all markers again
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
            let firstPoint = {lat: markers[i-1].latitude, lng: markers[i-1].longitude};
            let secondPoint = {lat: markers[i].latitude, lng: markers[i].longitude};
            let flightPath = new (<any>window).google.maps.Polyline({
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

    /**
     * Handle the change to the marker collection. Collection observer returns an array of splices which contains
     * information about the change to the collection.
     *
     * @param splices
     */
    markerCollectionChange(splices) {
        if (!splices.length) {
            // Collection changed but the splices didn't
            return;
        }

        for (let splice of splices) {
            if (splice.removed.length) {
                // Iterate over all the removed markers
                for (let removedObj of splice.removed) {
                    // Iterate over all the rendered markers to find the one to remove
                    for (let markerIndex in this._renderedMarkers) {
                        if (this._renderedMarkers.hasOwnProperty(markerIndex)) {
                            let renderedMarker = this._renderedMarkers[markerIndex];

                            // Check if the latitude/longitude matches - cast to string of float precision (1e-12)
                            if (renderedMarker.position.lat().toFixed(12) === removedObj.latitude.toFixed(12) &&
                                renderedMarker.position.lng().toFixed(12) === removedObj.longitude.toFixed(12)) {
                                // Set the map to null;
                                renderedMarker.setMap(null);

                                // Splice out this rendered marker as well
                                this._renderedMarkers.splice((<any>markerIndex), 1);
                                break;
                            }
                        }
                    }
                }
            }

            // Add the new markers to the map
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
                    (<any>window).google.maps.event.addListenerOnce(this.map, 'bounds_changed', function(event) {
                        this.setZoom(typeof self.zoom === 'number' ? self.zoom : parseInt(self.zoom));
                    });
                }
                let bounds = new (<any>window).google.maps.LatLngBounds();

                for (let marker of this.markers) {
                    // extend the bounds to include each marker's position
                    let markerLatLng = new (<any>window).google.maps.LatLng(parseFloat(marker.latitude), parseFloat(marker.longitude));
                    bounds.extend(markerLatLng);
                }
                this.map.fitBounds(bounds);
            });
        }
    }

    getMapTypeId() {
        if (this.mapType.toUpperCase() === 'HYBRID') {
            return (<any>window).google.maps.MapTypeId.HYBRID;
        } else if (this.mapType.toUpperCase() === 'SATELLITE') {
            return (<any>window).google.maps.MapTypeId.SATELLITE;
        } else if (this.mapType.toUpperCase() === 'TERRAIN') {
            return (<any>window).google.maps.MapTypeId.TERRAIN;
        }

        return (<any>window).google.maps.MapTypeId.ROADMAP;
    }

    error() {
        console.error.apply(console, arguments);
    }
}
