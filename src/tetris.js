/*
tetrisgame is overall game controller.

shapegenerator issues "shape-generated" event.
tetris binds to that new object. listening for "landed" event.
when "landed" event occurs, tetris invokes the shape generator again...

*/
var CONTINUOUS = true;
var GRID_UNIT = 0.1;


const cloneArray = (items) => items.map(item => Array.isArray(item) ? cloneArray(item) : item);


// Overall game controller.
AFRAME.registerComponent('tetrisgame', {
  schema: {
    generator: {type: 'string', default: ''}
  },

  // This caused problems (leads to shapegenerator init/update being calles with default values)
  // Don't reallyunderstand why, but trying to remove it.
  //dependencies: ['shapegenerator'],
  // Set up main game logic with attachment to specified shape generator.
  // Note, we won't handle updates to the shape generator.
  init: function () {

    // Find and initialize the scoreboard.
    this.scoreboard = document.querySelector(this.data.scoreboard);
    this.score = 0;
    this.scoreboard.setAttribute("text", "value: Score:" + this.score);

    this.layersRemoved = this.onLayersRemoved.bind(this);

    // Find and store the arena, and register for events that affect the score.
    const arenaElement = document.querySelector('#arena');

    arenaElement.addEventListener("layers-removed",
                                  this.layersRemoved);

    // Find & store the shape generator
    const generatorObj = document.querySelector(this.data.generator);
    const generator = generatorObj.components.shapegenerator;

    console.log(`Generator: ${this.data.generator}`);
    console.log(`Resolved to: ${generatorObj}`);
    console.log(`Resolved to: ${generator}`);

    if (!generatorObj) {
      console.log("Error - couldn't attach to shape generator")
    }

    generatorObj.addEventListener("new-shape", function (event) {
      // New shape generated.  Attach to it and track for landing.

      var shapeId = event.detail.shapeId;
      var shape = document.querySelector(shapeId);
      console.log("shapeId: " + shapeId);
      console.log("shape: " + shape);

      shape.addEventListener("landed", function () {

        // When one shape lands, we generate the next.
        console.log("Landed event detected");
        console.log("Create another shape");

        // This is a hack, need a cleaner way to interface with the arena
        // from this callback.  Bind a function or similar...
        if (!this.components.falling.arena.gameOverIndicator) {
          generator.generateShape();
        }
      });
    });

    // All set up, now generate the first shape.
    generator.generateShape();
  },

  onLayersRemoved: function(event) {

    // Layers removed.
    // Increase score by the square of the number of layers removed.
    // 1 point for 1 layer, 4 for 2 layers, 9 for 3 etc.
    this.score += Math.pow(event.detail.count, 2);

    console.log("Updating scoreboard");
    this.scoreboard.setAttribute("text", "value: Score:" + this.score);
  }
});


// Generate shapes.
AFRAME.registerComponent('shapegenerator', {
  schema: {
    shapes:          {type: 'array', default: ["EEE","EEN","ENE","ENSE","ENW","ENSD","EDN"]},
    keys:            {type: 'string', default: [`KeyY=zminus,
                                                 KeyH=zplus,
                                                 KeyG=xminus,
                                                 KeyJ=xplus,
                                                 Numpad8=xRotMinus,
                                                 Numpad5=xRotPlus,
                                                 Numpad4=yRotPlus,
                                                 Numpad6=yRotMinus,
                                                 Numpad7=zRotMinus,
                                                 Numpad9=zRotPlus,
                                                 Space=drop`]}
  },
  init: function () {
    this.shapeIndex = 0;
    this.latestShape = {};

    // long list of colours to accommodate many shape configs.
    // Current max is 2D Pentris with 13 shapes.
    this.shapeColors = [
      "#FF0",
      "#00F",
      "#FFF",
      "#F0F",
      "#0FF",
      "#0F0",
      "#F00",
      "#888",
      "#F80",
      "#F08",
      "#8F0",
      "#0F8",
      "#80F",
      "#08F"
    ]
  },

  update: function () {

    // clear out any previous shape models.
    this.shapeModels = [];

    this.data.shapes.forEach((item, index) => {

      /* String consists of a sequence of compass and up/down directions: EWNSUD
       *
       * We map to an array of [x, y, z] co-ordinates represnting the component
       * blocks.
       * Typically we have 3 compass directions & 4 co-ordinates.
       * But shapes might be any number of blocks (different variants)
       * and sometimes the compasss directions double back (e.g. for T)
       * We handle this case, and de-duplicate as necessary. */
       shapeData = shapeDataFromCompassData(item);
       this.shapeModels.push(shapeData);

     });

     function shapeDataFromCompassData(compassString) {

       // build he shape starting at 0, 0, 0.
       blockData = [0, 0, 0]
       shapeData = [];

       // Push a copy of block data into shape data.
       shapeData.push(blockData.map((x) => x));
       var xTotal = 0;
       var yTotal = 0;
       var zTotal = 0;

       for (var ii = 0; ii < compassString.length; ii++) {

         // N/S are z axis.
         // E/W are x axis.
         // U/D are y-axis
         switch (compassString.charAt(ii)) {

           case 'N':
             blockData[2] -=1;
             break;

           case 'S':
             blockData[2] +=1;
             break;

           case 'E':
             blockData[0] -=1;
             break;

           case 'W':
             blockData[0] +=1;
             break;

           case 'U':
             blockData[1] +=1;
             break;

           case 'D':
             blockData[1] -=1;
             break;

           default:
           // Bad config.
           console.log(`Unexpected character in shape data: ${compassString.charAt[ii]}`)
         }

         /* Now add this row, if it is not a duplicate... */
         if (!shapeData.find((item) => ((item[0] == blockData[0]) &&
                                        (item[1] == blockData[1]) &&
                                        (item[2] == blockData[2])))) {

           console.log(`Adding block data: x: ${blockData[0]}, y: ${blockData[0]}, z: ${blockData[0]}`)
           shapeData.push(blockData.map((x) => x));

           /* Keep a running total of the positions, used for centering later */
           xTotal += blockData[0]
           yTotal += blockData[1]
           zTotal += blockData[2]
         }
       }

       /* Finally, center the shape as best we can.
       * Take the average position in each axis,
       * round to nearest integer and shift by that. */
       var xShift = Math.round(xTotal/shapeData.length);
       var yShift = Math.round(yTotal/shapeData.length);
       var zShift = Math.round(zTotal/shapeData.length);

       console.log(`Recentering.  Shift by x:${xShift}, y: ${yShift}, z: ${zShift}`)
       shapeData.forEach((item, index) => {

         item[0] -= xShift;
         item[1] -= yShift;
         item[2] -= zShift;
       });

       return(shapeData);
     }
   },

  generateShape: function() {

    // Create the new shape.
    var sceneEl = document.querySelector('a-scene');

    var shapeId = "falling-shape-" + this.shapeIndex;
    var shapeProxyId = "proxy-shape-" + this.shapeIndex;
    modelChoice = Math.floor(Math.random() * (this.shapeModels.length));

    var entityEl = document.createElement('a-entity');
    entityEl.setAttribute("id", shapeProxyId);
    console.log(`Generating Shape with ID: #${shapeId}`)
    console.log(`Controlled by Proxy with ID: #${shapeProxyId}`)
    this.shapeIndex += 1;

    // Create the Proxy shape first- but before we do that, make sure any
    // previously created proxies are destroyed.
    // Shapes are responsible for their own lifecycle through the "falling"
    // component.  Yes, this is a little inconsistent -
    // clearing up everything here might be simpler & more robust...
    staleProxies = document.querySelectorAll('.proxy');
    for (var ii = 0; ii < staleProxies.length; ii++) {
      console.log("Destroying stale proxy:" + staleProxies[ii].id);
      staleProxies[ii].parentNode.removeChild(staleProxies[ii]);
    }

    entityEl.setAttribute('class', 'proxy');
    entityEl.setAttribute('sixdof-control-proxy', `controller:#rhand;target:#${shapeId};logger:#log-panel2;debug:true`);
    //entityEl.setAttribute('snap', `snap: ${GRID_UNIT} ${GRID_UNIT} ${GRID_UNIT}`);

    // Now finalize the object by attaching it to the scene.
    sceneEl.appendChild(entityEl);

    // Now create child entities, one for each cube that makes up the shape.
    // Typically there will be 4 of these (tetris), but we support other
    // shape configs too, maybe smaller or larger...
    for (var ii = 0; ii < this.shapeModels[modelChoice].length; ii++) {
      var blockEntity = document.createElement('a-entity');
      blockEntity.setAttribute("mixin", "cube");
      blockEntity.setAttribute("material", "color:#888; transparent:true; opacity:0.5");
      blockEntity.setAttribute('position', `${this.shapeModels[modelChoice][ii][0] * GRID_UNIT}
                                         ${this.shapeModels[modelChoice][ii][1] * GRID_UNIT}
                                         ${this.shapeModels[modelChoice][ii][2] * GRID_UNIT}`)
      entityEl.appendChild(blockEntity);
    }

    // Now the shape that is controlled by this proxy.
    var entityEl = document.createElement('a-entity');
    entityEl.setAttribute("id", shapeId);
    entityEl.setAttribute('position', this.el.object3D.position);
    entityEl.setAttribute('class', 'shape');
    entityEl.setAttribute('falling', "interval:1000; arena: #arena");
    entityEl.setAttribute('key-bindings', `debug:true;bindings:${this.data.keys}`);
    entityEl.setAttribute('sixdof-object-control', `proxy:#${shapeProxyId};logger:#log-panel;debug:true;movement:events`);
    //entityEl.setAttribute('snap', `snap: ${GRID_UNIT} ${GRID_UNIT} ${GRID_UNIT}`);

    // Now finalize the object by attaching it to the scene.
    sceneEl.appendChild(entityEl);

    // Now create child entities, one for each cube that makes up the shape.
    // Typically there will be 4 of these (tetris), but we support other
    // shape configs too, maybe smaller or larger...
    for (var ii = 0; ii < this.shapeModels[modelChoice].length; ii++) {
      var blockEntity = document.createElement('a-entity');
      blockEntity.setAttribute("mixin", "cube");
      blockEntity.setAttribute("material", "color: " + this.shapeColors[modelChoice]);
      blockEntity.setAttribute("shadow", "cast:true");
      blockEntity.setAttribute('position', `${this.shapeModels[modelChoice][ii][0] * GRID_UNIT}
                                         ${this.shapeModels[modelChoice][ii][1] * GRID_UNIT}
                                         ${this.shapeModels[modelChoice][ii][2] * GRID_UNIT}`)
      blockEntity.setAttribute('snap', `snap: ${GRID_UNIT} ${GRID_UNIT} ${GRID_UNIT}`);

      entityEl.appendChild(blockEntity);
    }

    // Announce the new shape to anyone who cares, including the shapeId.
    // Specifically this is monitored by the tetrisgame component, which is
    // responsible for generating more shapes when this one lands.
    this.el.emit('new-shape', {shapeId: "#" + shapeId});

    return (entityEl);
  }
});

// Falling component.
// Makes an object fall until position = 0
// Then it generates a "landed" event.
// Intervals is number of msecs between fall steps.
// Only a top-level shape should be registered as "falling"
// This handles parent + child components.
AFRAME.registerComponent('falling', {
  schema: {
     interval: {type: 'number'},
     arena: {type: 'string'},
     shapeindex: {type: 'string'},
   },

   init: function () {
     this.landed = false;
     this.arena = document.querySelector(this.data.arena).components.arena;
     this.interval = this.data.interval;
     this.startHeight = this.el.object3D.position.y;

     // watch for race conditions.
     this.testingNewPosition = false;

     this.listeners = {
       move: this.moveEventHandler.bind(this),
       rotate: this.rotateEventHandler.bind(this),
       xminus: this.xminus.bind(this),
       xplus: this.xplus.bind(this),
       zminus: this.zminus.bind(this),
       zplus: this.zplus.bind(this),
       xRotPlus: this.xRotPlus.bind(this),
       xRotMinus: this.xRotMinus.bind(this),
       yRotMinus: this.yRotMinus.bind(this),
       yRotPlus: this.yRotPlus.bind(this),
       zRotPlus: this.zRotPlus.bind(this),
       zRotMinus: this.zRotMinus.bind(this),
       drop: this.drop.bind(this)
     };
   },

   play: function () {
     this.attachEventListeners();
   },

   pause: function () {
     this.removeEventListeners();
   },

   remove: function () {
     this.pause();
   },

   attachEventListeners: function () {
     // These are the events we receive when bound to a 6dof controller.
     this.el.addEventListener('move', this.listeners.move, false);
     this.el.addEventListener('rotate', this.listeners.rotate, false);

     // These are the events we receive when bound to keyboard controls.
     this.el.addEventListener('xminus', this.listeners.xminus, false);
     this.el.addEventListener('xplus', this.listeners.xplus, false);
     this.el.addEventListener('zminus', this.listeners.zminus, false);
     this.el.addEventListener('zplus', this.listeners.zplus, false);
     this.el.addEventListener('xRotMinus', this.listeners.xRotMinus, false);
     this.el.addEventListener('xRotPlus', this.listeners.xRotPlus, false);
     this.el.addEventListener('yRotMinus', this.listeners.yRotMinus, false);
     this.el.addEventListener('yRotPlus', this.listeners.yRotPlus, false);
     this.el.addEventListener('zRotMinus', this.listeners.zRotMinus, false);
     this.el.addEventListener('zRotPlus', this.listeners.zRotPlus, false);
     this.el.addEventListener('drop', this.listeners.drop, false);
   },

   removeEventListeners: function () {
     // These are the events we receive when bound to a 6dof controller.
     this.el.removeEventListener('move', this.listeners.move);
     this.el.removeEventListener('rotate', this.listeners.rotate);

     // These are the events we receive when bound to keyboard controls.
     this.el.removeEventListener('xminus', this.listeners.xminus);
     this.el.removeEventListener('xplus', this.listeners.xplus);
     this.el.removeEventListener('zminus', this.listeners.zminus);
     this.el.removeEventListener('zplus', this.listeners.zplus);
     this.el.removeEventListener('xRotMinus', this.listeners.xRotMinus);
     this.el.removeEventListener('xRotPlus', this.listeners.xRotPlus);
     this.el.removeEventListener('yRotMinus', this.listeners.yRotMinus);
     this.el.removeEventListener('yRotPlus', this.listeners.yRotPlus);
     this.el.removeEventListener('zRotMinus', this.listeners.zRotMinus);
     this.el.removeEventListener('zRotPlus', this.listeners.zRotPlus);
     this.el.removeEventListener('drop', this.listeners.drop);
   },

   moveEventHandler: function(event) {
     // received "move" event from 6doF controller.
     // the event data just contains the abolute new position.

     console.log("Move Event from 6DOF Controller")
     logXYZ("Move data: ", event.detail, 2, true);

     // Overwrite the y data point with the current position.
     event.detail.y = this.el.object3D.position.y;

     this.moveAbsolute(event.detail);
   },

   moveAbsolute: function(newPosition) {
     // Is the new position viable?
     // Just move the shape, and see how it goes.
     var oldPosition = AFRAME.utils.clone(this.el.object3D.position);
     this.testingNewPosition = true;
     this.el.setAttribute('position', newPosition)
     logXYZ("Trying to move shape to:", newPosition, 2, true);

     if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
       // The move worked fine.
       moved = true;
     }
     else {
       // revert.
       this.el.setAttribute('position', oldPosition)
       moved = false;
     }
     this.testingNewPosition = false;

     return(moved);
   },

   // returns true if moved, false otherwise.
   moveRelative: function(xMove, yMove, zMove) {

     var moveVector = new THREE.Vector3();
     moveVector.x = xMove;
     moveVector.y = yMove;
     moveVector.z = zMove;

     // Pre-calculate where we are moving to (useful for logging in failure case)
     position = this.el.getAttribute('position');
     var newPosition = AFRAME.utils.clone(position);
     newPosition.x += xMove;
     newPosition.y += yMove;
     newPosition.z += zMove;

     var moved = this.moveAbsolute(newPosition);

     return(moved);
   },

   rotateEventHandler: function(event) {
     // received "rotate" event from 6doF controller.
     // the event data contains the Euler for the abolute new rotation.

     console.log("Rotate Event from 6DOF Controller")
     logXYZ("Rotate data: ", event.detail, 1, true);

     var quaternion = new THREE.Quaternion();
     quaternion.setFromEuler(event.detail)
     this.rotateAbsolute(quaternion);
   },

   rotateAbsolute: function(quaternion) {

     logQuat("Trying to rotate shape to:", quaternion, 1, true);

     // Before we rotate, save off the old quaternion.
     var oldQuaternion = new THREE.Quaternion();

     // Apply the new (absolute) rotation.
     // Copy, not multiply, as this is an absolute rotation,
     // not a relative one.
     this.testingNewPosition = true;
     this.el.object3D.quaternion.copy(quaternion);

     var rotated;
     // Is the new position viable?
     if (this.canShapeMoveHere(this.el, {'x': 0, 'y': 0, 'z': 0})) {
       // Yes, the move is viable.  Leave it in place.

       rotated = true;
     }
     else {
       // Undo the rotation.
       this.el.object3D.quaternion.copy(oldQuaternion);
       rotated = false;
     }
     this.testingNewPosition = false;

     return(rotated);
   },

   rotateRelative: function(xRad, yRad, zRad) {
     console.log("Trying to rotate shape")

     // to compose rotations reliably, we use Quaternion arithmetic.
     var eulerDelta = new THREE.Euler(xRad, yRad, zRad);
     var quaternionDelta = new THREE.Quaternion();
     quaternionDelta.setFromEuler(eulerDelta);

     // Get Absolute new rotation as a quaternion, by multiplying
     // current rotation by this delta.
     var quaternionAbsolute = new THREE.Quaternion();
     quaternionAbsolute.multiplyQuaternions(this.el.object3D.quaternion,
                                            quaternionDelta);

     // To determine whether we can rotate the shape, we just do the rotation,
     // then check if the position is viable.
     // If not, we can undo before any rendering takes place.
     rotated = this.rotateAbsolute(quaternionAbsolute)

     return(rotated);
   },

   zminus: function (event) {
     console.log("zminus");
     this.moveRelative(0, 0, -GRID_UNIT);
   },
   zplus: function (event) {
     console.log("zplus");
     this.moveRelative(0, 0, GRID_UNIT);
   },
   xminus: function (event) {
     console.log("xminus");
     this.moveRelative(-GRID_UNIT, 0, 0);
   },
   xplus : function (event) {
     console.log("xplus");
     this.moveRelative(GRID_UNIT, 0, 0);
   },

   xRotPlus: function (event) {
     console.log("xRotPlus");
     this.rotateRelative((Math.PI / 2), 0, 0);
   },
   xRotMinus: function (event) {
     console.log("xRotMinus");
     this.rotateRelative(-(Math.PI / 2), 0, 0);
   },
   yRotPlus: function (event) {
     console.log("yRotPlus");
     this.rotateRelative(0, (Math.PI / 2), 0);
   },
   yRotMinus: function (event) {
     console.log("yRotMinus");
     this.rotateRelative(0, -(Math.PI / 2), 0);
   },
   zRotPlus: function (event) {
     console.log("zRotPlus");
     this.rotateRelative(0, 0, (Math.PI / 2));
   },
   zRotMinus: function (event) {
     console.log("zRotMinus");
     this.rotateRelative(0, 0, -(Math.PI / 2));
   },
   drop: function (event) {
     // instant 5x multiplier to shape-fall speed.
     // Would be preferable to track up/down state for Space
     // bar, and removed acceleration when space key comes up...
     // Would require some more function in key-bindings.js...
     console.log("drop");
     this.interval = this.data.interval / 5;
   },

   canShapeMoveHere: function (element, moveVector) {

     var canMove = true;
     var worldPosition = new THREE.Vector3();

     // Loop through each sub-component in the shape.  If any one can't move, the
     // whole thing can't fall.
     childrenArray = Array.from(element.childNodes);

     for (ii = 0; ii < childrenArray.length; ii++) {

       // Need to get absolute position of each component block.
       childrenArray[ii].object3D.getWorldPosition(worldPosition);

       // This gives us the center of the shape.  Which is exactly what we want
       // to use to check position - safest co-ordinates to map to the cells matrix
       // maintained to track arena state.

       // Now add the proposed Move Vector
       worldPosition.x += moveVector.x;
       worldPosition.y += moveVector.y;
       worldPosition.z += moveVector.z;

       if (!this.arena.isOpenSpace(worldPosition)) {
         // we found a component that can't move.
         // So the whole object can't move.
         canMove = false;

         logXYZ("Object at this position can't move", worldPosition, 2, true);
         break;
       }
     }

     return (canMove);
   },

   tick: function (time, timeDelta) {
     // Check whether we crossed over a time boundary.
     //console.log("CLOCK: Tick called");

     // We are assuming tick won't be called while we are
     // testing out a new position.
     console.assert(!this.testingNewPosition);

     // Only blocks that haven't landed fall.
     if (!this.landed) {

       // Logic depends whether we are falling continuously or falling a block
       // at a time.
       var distanceToFall;

       // Track whether we landed (i.e. wanted to fall but couldn't).
       var justLanded = false;

       if (CONTINUOUS) {
         // Continuous movement.
         // Speed should be GRID_UNIT distance per this.interval msecs.
         if (timeDelta > 0) {
           distanceToFall = (GRID_UNIT * timeDelta) / this.interval;
           justLanded = !(this.moveRelative(0, -distanceToFall, 0));
         }
       }
       else {
         // discrete movement.
         // we fall GRID_UNIT every this.interval msecs.
         var last_time = time - timeDelta;
         var remainderNow = time % (this.interval);
         var lastRemainder = last_time % (this.interval);

         if (remainderNow < lastRemainder) {
           // We just crossed a time interval.  So make the object descend.

           justLanded = !(this.moveRelative(0, GRID_UNIT, 0));
         }
       }

       if (justLanded) {

         // if we are at or above our start point, then this is game over.
         // that trumps any processing for the fact that the piece has landed.
         if (this.el.object3D.position.y >= this.startHeight)
         {
           console.log("Game Over");
           this.arena.gameOver();
         }

         // Processing for mainline case: piece landed.
         this.landed = true;
         console.log("Landed: Emitting Event.");
         this.el.emit('landed');

         // Deactivate controls for this shape.
         // Unecessary as we're about to destroy the object anyway.
         //this.el.setAttribute('key-bindings', `debug:true;bindings:none`);

         this.arena.checkConsistency();

         // Integrate shape into arena surface.
         this.integrateShapeToArena(this.arena, this.el)
         // Note that arena may be inconsistent now, while new block creation
         // is underway.

         // destroy this shape (child blocks are in the process of being
         // re-created outside this context)
         this.el.parentNode.removeChild(this.el);

         // Don't worry about the Proxy - we clean that up at the point we
         // create a new one.

       }
     }
   },

   integrateShapeToArena: function (arena, element) {

     var childrenArray = Array.from(element.childNodes);

     for (ii = 0; ii < childrenArray.length; ii++) {

       arena.integrateBlock(childrenArray[ii]);
     }
   }
 });

/**
 * Snap entity to the closest interval specified by `snap`.
 * Offset entity by `offset`.
 */
AFRAME.registerComponent('snap', {
  dependencies: ['position'],

  schema: {
    snap: {type: 'vec3'}
  },

  init: function () {
    this.originalPos = this.el.getAttribute('position');
  },

  update: function () {
    const data = this.data;

    const pos = AFRAME.utils.clone(this.originalPos);
    pos.x = Math.floor(pos.x / data.snap.x) * data.snap.x;
    pos.y = Math.floor(pos.y / data.snap.y) * data.snap.y;
    pos.z = Math.floor(pos.z / data.snap.z) * data.snap.z;

    this.el.setAttribute('position', pos);
  }
});

// Arena "position" is at the (near left - check!) corner
AFRAME.registerComponent('arena', {
  dependencies: ['position'],

  schema: {
    x: {type: 'number'},
    z: {type: 'number'}
  },

  init: function () {

    console.log("Initializing Arena");
    this.width = this.data.x;
    this.depth = this.data.z;
    this.blocksPendingIntegrationCount = 0
    this.gameOverIndicator = false;

    // Falling blocks are tracked by the center of the block.
    // The cornerOffset is the offset between the arena "position"
    // (which is the center of the base plane)
    // and the point we want to deduct to get "cell position".
    // For Y, we must be precise, as blocks fall continuously.  The
    // correct point is half a grid unti above the plan.
    // For X & Z such precision is not required, as blocks only move in unit
    // increments.
    this.cornerOffset = new THREE.Vector3();
    this.cornerOffset.x = -(this.width / 2) * GRID_UNIT
    this.cornerOffset.z = -(this.depth / 2) * GRID_UNIT
    this.cornerOffset.y = (GRID_UNIT / 2);

    // Cells is a full 3d map of the whole play area, used
    // to decide where blocks can go, and when layers are completed.
    this.cellsArray = [];
  },

  gameOver: function() {
    // To be written.
    this.gameOverIndicator = true;
  },

  // Debug function to spot any discrepancies between the displayed model
  // and the cellsArray model.
  checkConsistency: function() {

    if (this.cellsArray.length > 0) {
      var clonedCellsArray = cloneArray(this.cellsArray);
    }
    else {
      var clonedCellsArray = [];
    }

    var sceneEl = document.querySelector('a-scene');
    var blockList = sceneEl.querySelectorAll('.block');

    for (blockIx = 0; blockIx < blockList.length; blockIx++) {

      var worldPosition = new THREE.Vector3();
      // Query will include the falling block.
      // Should Ignore these Not yet written code to do this..


      // since these blocks are not children, position should be fine...
      worldPosition = blockList[blockIx].object3D.position;

      if (worldPosition.z !== 0) {
        // Sometimes wold position is zero.  Not sure why, but pretty confident
        // these are false positives.  So ignore them.
        const cellIndex = this.worldPositionToCellIndices(worldPosition, true);

        if (this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] !== 1) {
          console.log("Found object not tracked in cellsArray");
          console.log(`Position: x:${cellIndex.x}, y:${cellIndex.y}, z:${cellIndex.z}`);
        }
        // Scrub this from the cloned cells array.  This helps us check that every
        // block in the cells array is represented by a block.

        clonedCellsArray[cellIndex.y][cellIndex.x][cellIndex.z] = 0;
      }
    }

    // Check for any marked cells unaccounted for...
    for (ii = 0; ii < clonedCellsArray.length; ii++) {
      for (jj = 0; jj < clonedCellsArray[ii].length; jj++) {
        for (kk = 0; kk < clonedCellsArray[ii][jj].length; kk++) {
          //console.log (ii + " " + jj + " " + kk);
          if (clonedCellsArray[ii][jj][kk] !== 0) {
            console.log("Found cells Array data with no corresponding object");
            console.log(`Layer: ${ii}, x: ${jj}, z: ${kk}`);
          }
        }
      }
    }
  },
  // Utility function to map a world position to an index into the
  // arena cells array.
  worldPositionToCellIndices: function(objectPosition, debug) {
    // Basic logic is:
    // - get corner position of arena
    // - subtract this from object position.
    // - scale down by grid unit size
    // - round to an integer, suitable for use as index into the array.
    // Vector arithmetic has not been working, so we (tediously) do
    // separate calculations for X, y & Z.

    const arenaPosition = this.el.getAttribute('position');

    // Extract x, y & z diffs, converting by grid units, and converting to integers.
    // Here we need to factor in difference between the corner and the center of the arena
    const xIndex = Math.floor((objectPosition.x - (arenaPosition.x + this.cornerOffset.x)) / GRID_UNIT);
    const yIndex = Math.floor((objectPosition.y - (arenaPosition.y + this.cornerOffset.y)) / GRID_UNIT);
    const zIndex = Math.floor((objectPosition.z - (arenaPosition.z + this.cornerOffset.z)) / GRID_UNIT);

    if (debug) {
      console.log(`Object: x: ${objectPosition.x}, y: ${objectPosition.y}, z: ${objectPosition.z}`)
      console.log(`Arena: x: ${arenaPosition.x}, y:${arenaPosition.y}, z:${arenaPosition.z}`)
      console.log(`Arena corner offset: x:${this.cornerOffset.x}, y:${this.cornerOffset.y}, z:${this.cornerOffset.z}`)
      console.log(`Indices: x:${xIndex}, y:${yIndex}, z:${zIndex}`)
    }

    return({'x': xIndex, 'y': yIndex, 'z': zIndex});
  },

  // Is this position (a) in the arena, and (b) not occupied already?
  // Recommend that this function is called with co-ordinates in the *center* of a cell
  // To avoid edge cases when dealing with edge co-ordinates.
  isOpenSpace: function (objectPosition) {
    var isOpenSpace;
    // Find the cell that maps to this position.
    const cellIndex = this.worldPositionToCellIndices(objectPosition);

    if ((cellIndex.x >= 0 && cellIndex.x < this.width) &&
        (cellIndex.z >= 0 && cellIndex.z < this.depth) &&
        (cellIndex.y >= 0)) {
      // Inside the arena.

      // Check the cells data, if it goes up high enough.
      // Note that cells data is populated as required (starts off empty
      // and fills up as the arena fills up.
      if (cellIndex.y >= this.cellsArray.length) {
        isOpenSpace = true;
      }
      else if (this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] == 0) {
        isOpenSpace = true;
      }
      else {
        // We found a populated cell in the cells array.
        isOpenSpace = false;
      }
    }
    else {
      // Outside the arena.  Not "Open Space".
      isOpenSpace = false;
    }

    return(isOpenSpace);
  },

  // Integrate a block of a shape object that has fallen into the arena floor.
  integrateBlock: function (blockElement) {

    // Get the absolute position of the block.
    var worldPosition = new THREE.Vector3();
    blockElement.object3D.getWorldPosition(worldPosition);

    var cellIndex = this.worldPositionToCellIndices(worldPosition, true);

    // Now we populate cellsArray with an indication that this cell is occupied.

    // Create new layer(s) if needed.
    // (with a tall shape, we might need to create 3-4 new layers)
    var layersNeeded = cellIndex.y + 1;
    if (this.cellsArray.length < layersNeeded) {
      for (var kk = this.cellsArray.length;  kk <= layersNeeded; kk++) {
        var dataLayer = [];
        for (var ii = 0; ii < this.width; ii++) {
          var dataRow = [];
          for (var jj = 0; jj < this.depth; jj++) {
            dataRow.push(0);
          }
          dataLayer.push(dataRow);
        }

        this.cellsArray.push(dataLayer);
      }
    }

    // Now mark the new location that has been filled.
    this.cellsArray[cellIndex.y][cellIndex.x][cellIndex.z] = 1;

    // Have had loads of problems re-parenting, despite following guidance here:
    // https://github.com/aframevr/aframe/issues/2425
    // Far simpler just to create new blocks in the required locations.

    // Note that creating the new elements is *Asynchronous*
    // We want to check for any completed layers, and delete them.
    // But we don't want to do that processing until the new blocks are
    // correctly in place, or things will get into a mess!

    // We solve this problem by:
    // - Setting a counter on the Arena: blocks_to_integrate
    // - Setting the "integration-tracker" component on the new objects

    var sceneEl = document.querySelector('a-scene');
    var entityEl = document.createElement('a-entity');

    entityEl.setAttribute("mixin", "cube");
    entityEl.setAttribute("material", blockElement.getAttribute("material"));
    entityEl.setAttribute('position', `${worldPosition.x}
                                       ${worldPosition.y}
                                       ${worldPosition.z}`)
    entityEl.setAttribute('class', 'block');
    entityEl.setAttribute('integration-tracker', "arena: #arena");
    sceneEl.appendChild(entityEl);
    this.blocksPendingIntegrationCount++;

    // And destroy the old element.
    blockElement.parentNode.removeChild(blockElement);

    return;
  },

  // Called when a block is integrated into the scene.
  // i.e. when the async create process for a new block that has Landed
  // completes.
  blockIntegrated: function () {

    this.blocksPendingIntegrationCount--;

    if (this.blocksPendingIntegrationCount == 0) {

      this.checkConsistency();

      var layersRemoved = this.removeAnyCompleteLayers();

      if (layersRemoved > 0) {
        this.el.emit("layers-removed", {count: layersRemoved});
      }

      this.checkConsistency();
    }
  },

  // Remove any complete layers.
  // This is not done on a per-block basis, because we want to be able to
  // identify multiple simultaneous eliminations.
  // Also because we don't want to start moving blocks down a layer until
  // the whole shape that landed has been integrated.

  // Returns number of layers removed.
  removeAnyCompleteLayers: function () {

    var layersRemoved = 0;

    // Analyze from top to bottom, as this works better when handling multiple
    // layers disappearing in one go.
    for (var ii = this.cellsArray.length - 1; ii >= 0; ii--) {
      // A complete layer will have cell count of width x depth.
      // Assuming arena shape is a simple rectangles, which is valid for now at least...

     layerCellCount = this.cellsArray[ii].reduce((a,b) => a.concat(b)) // flatten array
                                         .reduce((a,b) => a + b);      // sum

      if (layerCellCount == (this.width * this.depth)) {
        // complete layer.
        layersRemoved ++;

        // Remove the layer.
        // First our basic cell tracking.
        this.cellsArray.splice(ii, 1);

        // Now we ierate through all blocks in the scene, and for each, we:
        // - remove it if it's in the vanishing layer
        // - move it down if it's above the vanishing layer.
        // - do nothing if it's below.
        var sceneEl = document.querySelector('a-scene');
        var blockList = sceneEl.querySelectorAll('.block');

        for (blockIx = 0; blockIx < blockList.length; blockIx++) {

          // Since block objects are parented to the scene, we can
          // just read (and update) position directly,
          // no need to access "world position".

          var position = blockList[blockIx].getAttribute('position');

          const cellIndex = this.worldPositionToCellIndices(position, true);

          if (cellIndex.y == ii) {
            // In this layer.  Destroy the block.
            sceneEl.removeChild(blockList[blockIx]);
          }
          else if (cellIndex.y > ii) {
            // layer above - move down.
            position.y -= GRID_UNIT;
            //blockList[blockIx].flushToDOM();
          }
        }
      }
    }
    return (layersRemoved);
  }
});

AFRAME.registerComponent('integration-tracker', {
  // This will be called after the entity has properly attached and loaded.
  // In this context, that means that the fallen block is integrated into the
  // scene.
  init: function () {
    var arena = document.querySelector(this.data.arena).components.arena;

    // Notify the arena the block fell into.  When all pending integrations
    // complete, it will continue with it's processing.
    console.log('Block creation completed for one block.');
    arena.blockIntegrated();
  }
});

function logXYZ(text, pos, dp, debug = false) {

  var logtext = `${text} x: ${pos.x.toFixed(dp)}, y: ${pos.y.toFixed(dp)}, z: ${pos.z.toFixed(dp)}\n`
  if (debug) {
    console.log(logtext);
  }
  return (logtext);
}
