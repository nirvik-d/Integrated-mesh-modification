import "./style.css";

import "@arcgis/map-components/components/arcgis-scene";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-navigation-toggle";
import "@arcgis/map-components/components/arcgis-compass";
import "@arcgis/map-components/components/arcgis-placement";
import "@esri/calcite-components/components/calcite-panel";
import "@esri/calcite-components/components/calcite-scrim";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-block";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import SceneModification from "@arcgis/core/layers/support/SceneModification";
import SceneModifications from "@arcgis/core/layers/support/SceneModifications";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import Layer from "@arcgis/core/layers/Layer";
import IntegratedMeshLayer from "@arcgis/core/layers/IntegratedMeshLayer";
import IntegratedMesh3DTilesLayer from "@arcgis/core/layers/IntegratedMesh3DTilesLayer";

// Get the SceneView element from the DOM
const arcgisScene: HTMLArcgisSceneElement | null =
  document.querySelector("arcgis-scene");
if (!arcgisScene) {
  throw new Error("Scene element not found");
}
await arcgisScene.viewOnReady();

// Create a GraphicsLayer for displaying graphics
const graphicsLayer: GraphicsLayer = new GraphicsLayer();
arcgisScene.map?.add(graphicsLayer);

// Find the integrated mesh layer in the map
// Supports both integrated-mesh and integrated-mesh-3dtiles types
const imLayer: IntegratedMeshLayer | IntegratedMesh3DTilesLayer | undefined =
  arcgisScene.map?.layers.find((layer) => {
    return (
      layer.type === "integrated-mesh" ||
      layer.type === "integrated-mesh-3dtiles"
    );
  }) as IntegratedMeshLayer | IntegratedMesh3DTilesLayer | undefined;

// Get the scrim element for loading states
const scrim: HTMLCalciteScrimElement | null =
  arcgisScene.querySelector("calcite-scrim");
if (!scrim) {
  throw new Error("Scrim element not found");
}

// Wait for the layer view to be ready
let imLayerView: __esri.LayerView = await arcgisScene.whenLayerView(
  imLayer as Layer
);

// Show the panel when layer is ready
const panel = document.querySelector("calcite-panel");
if (!panel) {
  throw new Error("Panel element not found");
}
panel.style.display = "flex";

// Add a handle to hide the loader when updates are complete
imLayerView.addHandles(
  reactiveUtils.when(
    () => !imLayerView.updating,
    () => setLoaderVisibility(false)
  )
);

// Define the symbol for the sketch tool
// Uses a semi-transparent white fill for 3D polygons
const sketchSymbol: __esri.PolygonSymbol3DProperties & { type: "polygon-3d" } =
  {
    type: "polygon-3d",
    symbolLayers: [
      {
        type: "fill",
        material: {
          color: [255, 255, 255, 0.8],
        },
        outline: {
          size: "3px",
          color: [82, 82, 122, 1],
        },
      },
    ],
  };

// Create the SketchViewModel
const sketchViewModel: __esri.SketchViewModel = new SketchViewModel({
  layer: graphicsLayer,
  polygonSymbol: sketchSymbol,
  view: arcgisScene.view,
  updateOnGraphicClick: false,
});

// Add event listeners for the create and update buttons
const createModificationButton: HTMLCalciteButtonElement | null =
  document.querySelector("#createModification");
if (!createModificationButton) {
  throw new Error("Create modification button not found");
}
createModificationButton.addEventListener("click", () => {
  createModificationButton.setAttribute("disabled", "");
  sketchViewModel.create("polygon");
});

// Add event listeners for the modification control
const modificationControl: HTMLCalciteSegmentedControlElement | null =
  document.querySelector("#modificationControl");
if (!modificationControl) {
  throw new Error("Modification control not found");
}
modificationControl.addEventListener("click", () => {
  const graphic = sketchViewModel.updateGraphics.getItemAt(0);
  if (graphic) {
    updateModificationType(graphic, modificationControl.value);
  }
});

// Listen to create events on the sketchViewModel
sketchViewModel.on("create", (event) => {
  if (event.state === "cancel") {
    createModificationButton.removeAttribute("disabled");
  } else if (event.state === "complete") {
    createModificationButton.removeAttribute("disabled");
    updateModificationType(event.graphic, modificationControl.value);
  }
});

// Listen to update events on the sketchViewModel
sketchViewModel.on("update", (event) => {
  if (event.state === "active") {
    updateIntegratedMesh();
  }
});

// Listen to delete events on the sketchViewModel
sketchViewModel.on("delete", updateIntegratedMesh);

// Listen to click events in the view element to detect if the user would like to update an existing graphic in the scene
arcgisScene.addEventListener("arcgisViewClick", (event) => {
  arcgisScene
    .hitTest(event.detail, {
      include: [graphicsLayer],
    })
    .then((response) => {
      const result = response.results[0];
      if (result?.type === "graphic") {
        processSelectedGraphic(result.graphic);
      }
    });
});

// Process the selected graphic
function processSelectedGraphic(graphic) {
  if (sketchViewModel.state === "ready") {
    const modificationType = graphic.attributes.modificationType;
    if (!modificationControl) {
      throw new Error("Modification control not found");
    }
    const type: HTMLCalciteSegmentedControlItemElement | null =
      modificationControl.querySelector(`[value=${modificationType}]`);
    if (!type) {
      throw new Error("Modification type not found");
    }
    type.checked = true;
    sketchViewModel.update(graphic, {
      enableZ: modificationType === "replace",
    });
  }
}

// Update the modification type of the selected graphic
function updateModificationType(graphic, modificationType) {
  graphic.attributes = { modificationType: modificationType };

  const colors = {
    clip: [252, 173, 88],
    mask: [157, 219, 129],
    replace: [133, 148, 209],
  };

  // Polygon symbol used to represent finalized modifications
  graphic.symbol = {
    type: "polygon-3d", // autocasts as new PolygonSymbol3D()
    symbolLayers: [
      {
        type: "fill", // autocasts as new FillSymbol3DLayer()
        outline: {
          color: colors[modificationType],
          size: "7px",
        },
      },
    ],
  };

  updateIntegratedMesh();

  sketchViewModel.update(graphic, {
    enableZ: modificationType === "replace",
  });
}

// Apply the modifications to the integrated mesh
// - create the modification collection using data from the graphics layer (geometry and modification type)
function updateIntegratedMesh() {
  if (!imLayer) {
    throw new Error("Integrated mesh layer not found");
  }
  imLayer.modifications = new SceneModifications(
    graphicsLayer.graphics.toArray().map((graphic) => {
      return new SceneModification({
        geometry: graphic.geometry,
        type: graphic.attributes.modificationType,
      });
    })
  );
  // show loader overlay when modifications are changed
  setLoaderVisibility(true);
}

// Show / hide loader overlay
function setLoaderVisibility(visible) {
  if (!scrim) {
    throw new Error("Scrim element not found");
  }
  scrim.style.display = visible ? "flex" : "none";
}
