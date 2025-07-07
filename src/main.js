const [
  GraphicsLayer,
  SketchViewModel,
  SceneModification,
  SceneModifications,
  reactiveUtils,
] = await $arcgis.import([
  "@arcgis/core/layers/GraphicsLayer.js",
  "@arcgis/core/widgets/Sketch/SketchViewModel.js",
  "@arcgis/core/layers/support/SceneModification.js",
  "@arcgis/core/layers/support/SceneModifications.js",
  "@arcgis/core/core/reactiveUtils.js",
]);

// Get the SceneView element from the DOM
const arcgisScene = document.querySelector("arcgis-scene");

// Wait for the view to be ready before proceeding
await arcgisScene.viewOnReady();

// Create a GraphicsLayer for displaying graphics
const graphicsLayer = new GraphicsLayer();
arcgisScene.map.add(graphicsLayer);

// Find the integrated mesh layer in the map
// Supports both integrated-mesh and integrated-mesh-3dtiles types
const imLayer = arcgisScene.map.layers.find((layer) => {
  return (
    layer.type === "integrated-mesh" || layer.type === "integrated-mesh-3dtiles"
  );
});

// Get the scrim element for loading states
const scrim = arcgisScene.querySelector("calcite-scrim");
let imLayerView;

// Wait for the layer view to be ready
arcgisScene.whenLayerView(imLayer).then((layerView) => {
  // Show the panel when layer is ready
  document.querySelector("calcite-panel").style.display = "flex";
  imLayerView = layerView;
  
  // Add a handle to hide the loader when updates are complete
  layerView.addHandles(
    reactiveUtils.when(
      () => !layerView.updating,
      () => setLoaderVisibility(false)
    )
  );
});

// Define the symbol for the sketch tool
// Uses a semi-transparent white fill for 3D polygons
const sketchSymbol = {
  type: "polygon-3d", // autocasts as new PolygonSymbol3D()
  symbolLayers: [
    {
      type: "fill", // autocasts as new FillSymbol3DLayer()
      material: {
        color: [255, 255, 255, 0.8], // Semi-transparent white
      },
      outline: {
        size: "3px",
        color: [82, 82, 122, 1],
      },
    },
  ],
};

// Create the SketchViewModel
const sketchViewModel = new SketchViewModel({
  layer: graphicsLayer,
  polygonSymbol: sketchSymbol,
  view: arcgisScene.view,
  updateOnGraphicClick: false,
});

// Add event listeners for the create and update buttons
const createModificationButton = document.getElementById("createModification");
createModificationButton.addEventListener("click", () => {
  createModificationButton.setAttribute("disabled", "");
  sketchViewModel.create("polygon");
});

// Add event listeners for the modification control
const modificationControl = document.getElementById("modificationControl");
modificationControl.addEventListener("click", (event) => {
  const graphic = sketchViewModel.updateGraphics.items[0];
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
    modificationControl.querySelector(
      `[value=${modificationType}]`
    ).checked = true;
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
  scrim.style.display = visible ? "flex" : "none";
}
