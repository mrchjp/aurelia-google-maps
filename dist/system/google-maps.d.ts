export declare class GoogleMaps {
    private element;
    private taskQueue;
    private config;
    private bindingEngine;
    private eventAggregator;
    _DEFAULT_ADDRESS: any;
    _DEFAULT_LONGITUDE: number;
    _DEFAULT_LATITUDE: number;
    _DEFAULT_ZOOM: number;
    _DEFAULT_MARKERS: any[];
    address: any;
    longitude: number;
    latitude: number;
    zoom: number;
    disableDefaultUI: boolean;
    markers: any[];
    autoUpdateBounds: boolean;
    mapType: string;
    loadMapApiScript: boolean;
    drawConnectMarkerLines: boolean;
    map: any;
    _renderedMarkers: any[];
    _markersSubscription: any;
    _scriptPromise: any;
    _mapPromise: any;
    _mapResolve: any;
    _locationByAddressMarkers: any[];
    constructor(element: any, taskQueue: any, config: any, bindingEngine: any, eventAggregator: any);
    bind(): void;
    _triggerPropertyChangedHandler(): void;
    _clearMarkers(): void;
    attached(): void;
    sendBoundsEvent(): void;
    sendApiLoadedEvent(): void;
    renderMarker(marker: any): void;
    geocodeAddress(address: any, geocoder: any): void;
    getCurrentPosition(): any;
    loadApiScript(): any;
    setOptions(options: any): void;
    createMarker(options: any): any;
    getCenter(): void;
    setCenter(latLong: any): void;
    updateCenter(): void;
    addressChanged(newValue: any): void;
    latitudeChanged(newValue: any): void;
    longitudeChanged(newValue: any): void;
    zoomChanged(newValue: any): void;
    markersChanged(newValue: any): void;
    _drawConnectMarkerLines(markers: any): void;
    _getRandomInt(min: any, max: any): any;
    markerCollectionChange(splices: any): void;
    zoomToMarkerBounds(): void;
    getMapTypeId(): any;
    error(): void;
}
