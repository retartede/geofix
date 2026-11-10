import "leaflet";

declare module "leaflet" {
  interface MarkerClusterGroupOptions extends LayerOptions {
    showCoverageOnHover?: boolean;
    maxClusterRadius?: number;
    spiderfyOnMaxZoom?: boolean;
    disableClusteringAtZoom?: number;
    iconCreateFunction?: (cluster: MarkerCluster) => DivIcon | Icon;
  }

  class MarkerCluster extends Marker {
    getChildCount(): number;
  }

  class MarkerClusterGroup extends FeatureGroup {
    constructor(options?: MarkerClusterGroupOptions);
  }

  function markerClusterGroup(
    options?: MarkerClusterGroupOptions,
  ): MarkerClusterGroup;
}

declare module "leaflet.markercluster";
