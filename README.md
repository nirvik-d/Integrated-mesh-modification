# Integrated Mesh Modification

A 3D visualization tool built with ArcGIS Maps SDK for JavaScript and Calcite Web Components, allowing users to modify and interact with 3D integrated mesh data.

## Features

* **3D Visualization:** Interactive 3D scene with integrated mesh support
* **Mesh Layer Support:** Works with both integrated-mesh and integrated-mesh-3dtiles layers
* **Graphics Layer:** Add custom graphics to the scene
* **Reactive Updates:** Real-time updates using reactiveUtils
* **Loading States:** Visual feedback during data loading

## Screenshots

*1. Main application*


## Prerequisites

* Node.js
* Vite

## Project Setup

1.  **Initialize Project**

    ```bash
    # Create a new Vite project
    npm create vite@latest
    ```

    Follow the instructions on screen to initialize the project.

2.  **Install Dependencies**

    ```bash
    npm install
    ```

## Code Structure

### HTML Structure

The HTML file sets up the basic structure for the ArcGIS web application:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="initial-scale=1,maximum-scale=1,user-scalable=no"
    />
    <title>Integrated Mesh Modification</title>
    <link rel="stylesheet" href="./src/style.css" />
    <script type="module" src="https://js.arcgis.com/calcite-components/3.2.1/calcite.esm.js"></script>
    <link rel="stylesheet" href="https://js.arcgis.com/4.33/esri/themes/light/main.css" />
    <script src="https://js.arcgis.com/4.33/"></script>
    <script type="module" src="https://js.arcgis.com/4.33/map-components/"></script>
  </head>
  <body>
    <arcgis-scene item-id="d6eefc2b1e984e1eaf1c290588a52c55">
      <arcgis-zoom position="top-left"></arcgis-zoom>
      <arcgis-navigation-toggle position="top-left"></arcgis-navigation-toggle>
      <arcgis-compass position="top-left"></arcgis-compass>
      <calcite-scrim></calcite-scrim>
      <calcite-panel style="display: none; flex-direction: column;">
        <!-- UI controls will be added here -->
      </calcite-panel>
    </arcgis-scene>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
```

### CSS Styling

The CSS file provides styling for the map view and UI elements:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

#styleControl {
  text-align: center;
  position: absolute;
  bottom: 20px;
  max-width: 300px;
  margin: auto;
  left: 0;
  right: 0;
  align-items: center;
}
```

### JavaScript Implementation

1. **Module Imports**

```javascript
// Import required ArcGIS modules using $arcgis.import
// - GraphicsLayer: For displaying graphics
// - IntegratedMeshLayer: For 3D mesh data
// - reactiveUtils: For reactive updates
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
```

2. **Scene Setup**

```javascript
// Get the SceneView element from the DOM
const arcgisScene = document.querySelector("arcgis-scene");

// Wait for the view to be ready before proceeding
await arcgisScene.viewOnReady();

// Create a GraphicsLayer for displaying graphics
const graphicsLayer = new GraphicsLayer();
arcgisScene.map.add(graphicsLayer);
```

3. **Mesh Layer Handling**

```javascript
// Find the integrated mesh layer in the map
// Supports both integrated-mesh and integrated-mesh-3dtiles types
const imLayer = arcgisScene.map.layers.find((layer) => {
  return (
    layer.type === "integrated-mesh" || layer.type === "integrated-mesh-3dtiles"
  );
});
```

4. **Layer View Setup**

```javascript
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
```

5. **Graphics Symbol Definition**

```javascript
// Define the symbol for the sketch tool
// Uses a semi-transparent white fill for 3D polygons
const sketchSymbol = {
  type: "polygon-3d",
  symbolLayers: [
    {
      type: "fill",
      material: {
        color: [255, 255, 255, 0.8],
      },
      outline: {
        size: "3px",
        color: [255, 255, 255],
      },
    },
  ],
};
```

6. **Sketch ViewModel Setup**

```javascript
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
    updateModificationType(event.detail.item.value, graphic);
  }
});
```

7. **Event Listeners**

```javascript
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
      layer: graphicsLayer
    })
    .then((response) => {
      if (response.results.length) {
        sketchViewModel.update(response.results[0].graphic);
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
```

8. **Mesh Modification**

```javascript
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
```

## Running the Application

1. **Development Server**

   ```bash
   npm run dev
   ```

   This will start the development server at `http://localhost:5173`

2. **Build for Production**
   ```bash
   npm run build
   ```
