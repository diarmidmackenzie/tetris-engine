# blocks-engine.js
A set of A-Frame components that enable VR Falling Block games (2D and 3D) to be created using just HTML.



### Overview

With just a few lines of HTML, you can put a falling blocks game into any A-Frame VR world.*

It can be 2D or 3D, it can use any set of shapes you choose, and you can customize various other aspects too.

The project is at a very early stage of development.  There are some major limitations and bugs, but it's already offers a fun moving forward quickly!

(* That's the promise... we're not quite there yet - see Limitations below) 



### Supported Platforms

This is a VR-first implementation, but games can also be played in a WebXR-capable browser on a computer using keyboard controls.  There are no current options available for playing on smartphones or tablets.

In terms of compatibility for VR headsets and other XR devices...

- In principle this should work in any browser hat supports WebXR

- In practise, it's been built with Oculus Quest 2 in mind, and that's the only platform it's been tested on so far.

- The VR controls have been built for 6DoF controllers.  They are unlikely to work with 3DoF controllers.

  

### "I Just Want To Play The Game..."

Take a look at https://blocksarcade.xyz

That's a VR gaming arcade offering a wide range of falling blocks games, built using this engine.



### User Controls

On keyboard, the controls are completely customizable.  The example games use:

- All games: Backspace to start, or restart mid-game.
- For 2D games:
  - Z/X for L/R, Enter/RShift for rotate, Space to drop.
- For 3D games:
  - YGHJ (like WASD) to move blocks in the x-z plane
  - Number Pad for rotations:
    - 4/6 for yaw
    - 7/9 for roll
    - 5/8 for pitch.
- The example games also support movement in VR using WASD or cursor keys, and gaze control using the mouse.  But this is just standard A-Frame stuff, nothing to do with blocks-engine.

On a VR 6DoF controller, the controls are the same for 2D and 3D games, and again customizable (see below).  The example games use:

- A to start.
- Hold grip down and move to move the shape (in the x-z plane only)
- Hold trigger down and rotate the controller to rotate the object.
- Holding grip + trigger at the same time allows simultaneous rotation and movement.
- There is no control to "drop" a block - blocks fall at a constant (slow) speed.

These controls are far from perfect, and I expect to make changes, and add customization options in the near future.



### Installation

From JSDelivr CDN:

```
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/blocks-engine@v0.4-alpha/src/blocks.min.js"></script>
```

There are also some dependencies you'll need from other repos:

A-Frame:

```
<script src="https://aframe.io/releases/1.1.0/aframe.min.js"></script>
```

If you want 6DoF controls for VR:

```
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/6dof-object-control@v0.1-alpha/src/6dof-object-control.min.js"></script>
```

If you want keyboard controls for 2D browser:

    <script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/key-bindings@latest/key-bindings.min.js"></script>
And if you want to simulate a 6DoF controller using a computer keyboard (for debugging purposes: not recommended for actual gameplay!)

```
<script src="https://cdn.jsdelivr.net/gh/diarmidmackenzie/6dof-object-control@latest/src/keyboard-hand-controls.min.js"></script>
```



#### Basic Usage

See the examples directory for some basic examples.  At a very high level, you'll need the following elements in your A-Frame scene:

1. An entity for the 6DoF controller you want to use
2. A mixin called "cube" (that's the  default - customizable as per details below) which contains some basic info about the appearance of the blocks you want to play with.
3. An entity with the blocksgame component.
4. An entity with the shapegenerator component, positioned where you want shapes to spawn.
5. A horizontal plane entity, with the arena component, that describes the surface onto which the pieces will fall.
6. If you want shadows (3D games can be hard to play without them) a light source positioned about 20m directly above the arena.
7. A scoreboard, and other text display panels as required.

1, 2, 6 & 7 are standard A-Frame components.  Please refer to the examples, and the A-Frame documentation if anything is not clear.  https://aframe.io/docs/1.1.0/introduction/

Details on the properties to set for the components in 3, 4 & 5 are covered below.



### Component Interfaces

#### blocksgame

A very simple component, configured with the following properties:

- generator: The element ID of the shape generator used in this game.  Default value is: #shapegenerator.
- scoreboard: The element ID of an <a-text> element used to report the score, current level, and game duration.  This is mandatory, and the element must exist (if you don't want to show this information, just define an element and make it invisible).  Default value is "#scoreboard".
- arena: The element ID of the arena used in the game.  Default value is: #arena.
- levelduration: How long, in seconds, before moving up to the next level (which increases block speed).  Default: 60 seconds.
- initialspeed: How long, in msecs, it takes for a block to fall one space, at the start of the game.  Lower values indicate faster falling.  Default 1000.
- levelspeedup: A percentage increase applied to the speed on each level.  This percentage is deducted from the time taken to fall one block, each time the level is increased.  Default 10 - which results in the speed doubling every 6-7 levels (i.e. every 6-7 minutes with the default settings).
- tutorial: Defaults to false.  Set to true if you want to use the game engine to build a tutorial on how to play.  When this is set, shapes do not fall by default (unless explicitly dropped), and new shapes are not generated automatically - instead a "nextStep" event is emitted to a configurable entity, which can control what happens next.
- tutorialentity: Only used when "tutorial" is set to true.  A selector for the entity on which the "nextStep" event should be emitted, as per previous property.

The game is started, or restarted, by generating the event "start" on the entity on which blocksgame is configured.  This can be set in HTML using the latest key-bindings.js (see above), for example by setting this property, which sets the Backspace Key, and A button controller on the right hand, to start controls.

```
key-bindings="debug:true;bindings:Backspace=start,#rhand.abuttondown=start"
```

See key-binding.js docs & example HTML for more on this.

#### shapegenerator

The properties that can be set on this component are:

- arena: The element ID of the arena used in the game.  Default value is: #arena.

- shapes: An array of strings indicating the set of shapes to use in the game.  They are all generated with equal probability.  Examples of such strings are EEE (a 4-long block) and EED (a classic "knight's move" L shape).  See below for how these strings are defined.  There's currently a limit of 14 different shapes.

- keys: A mapping of keys to events, which defines the keyboard controls for the game.  The format of the string is as used by the key-bindings.js component.  The events mapped to are:

  - zminus, zplus, xminus, xplus: movement in the x-z plane.
  - xRotMinus/xRotPlus: rotation about the x-axis (pitch)
  - yRotMinus/yRotPlus: rotation about the x-axis (yaw)
  - zRotMinus/zRotPlus: rotation about the z-axis (roll)
  - drop: accelerate the rate of falling of this shape.

  If keys are not specified, they will default to the default controls for 3D games.  For VR-only applications, it shouldn't matter what keys are set, as the player won't be using the keyboard.

- move: An array of controls which control will enable movement of the object, when using a 6doF controller.  Each entry in the array is of the form {controller}.{control}, where {controller} is an ID for the relevant controller entity (e.g. #rhand or #lhand), and control is one of : grip, trigger or thumbstick.  Default is #lhand.thumbstick,#rhand.grip

- rotate: An array of controls which control will enable movement of the object, when using a 6doF controller.  Each entry in the array is of the form {controller}.{control}, where {controller} is an ID for the relevant controller entity (e.g. #rhand or #lhand), and control is one of : grip, trigger or thumbstick.  Default is #rhand.thumbstick,#rhand.trigger.

  It is OK to set move & rotate to overlapping values if desired.  This can work well for some controls (e.g. grip/trigger), but less well for thumbstick controls.

  For full details on how the control systems work, see the README for the 6dof-object-control components.

- nextshape: (optional) the ID of an entity with a location at which the next block to fall is shown.  If this is not provided, the next block is not shown.

- globalmixin: (default: cube) the name of a mixin to be applied to the blocks.  This should contain geometry and scale information (box, and "0.1 0.1 0.1" are a good starting point!).  It does not need to contain color information, which will be applied to the blocks separately based on a hard-coded list of colors.  If you want to customize the colors, see the "pershapemixin"option.

- pershapemixin: (default: "") the prefix of a set of mixin names to be applied to the blocks.  There should be a set of mixins with names of the form: <pershapemixin><number>, where number starts at 0 and goes up.  There should be enough mixins to cover the number of different shape types  configured under "shapes".  Mixins will be assigned to shapes in order.  This mixin should include geometry, scale and material information.  When this is specified, the "globalmixin" setting is also applied to the shape, but no color is added other than what is specified in the mixin.

- arenaperhapemixin: (default: "") this operates exactly like peshapemixin (i.e. it is a prefix of a set of numbered mixins starting from 0), but it applies at the point the block lands in the arena.  This allows for landed blocks to have a different appearance from in-flight blocks.  It can also be a good way to apply other changes to blocks as they land, for example making them become members of an Instanced Mesh, which can help significantly with performance. (see diarmidmackenzie/instanced-mesh/ and diarmidmackenzie/blocks-arcade/ for more details and examples).  Note that arenapershapemixin completely overrides both globalmixin and pershapemixin, for shapes once they have landed.

- tutorial: Similar to the same parameter on the blocksgame component.  Shapes do not fall unless explicitly dropped.

- debug: Set "debug:true" on either to enable detailed console logging, and real-time data output to logger elements.

- logger1: Must be set if debug is true.  Set to the ID of an <a-text> element to out real-time positional data (of the target shape).  Default value is #log-panel1.

- logger2: Must be set if debug is true.  Set to the ID of an <a-text> element to out real-time positional data (of the proxy control object - see 6dof-object-control for bakground on what this is).  Default value is #log-panel2.

The element assigned the shapegenerator component must also have the following A-Frame properties set.

- An id, so that it can be references by the blocksgame component.
- A position.  This position must be in the same position space as the arena, and must be vertically above the arena, typically in the center of the arena.  Note also that this position should be aligned to a 10cm boundary, matching the block size of the game - not meeting this requirement will result in unpredictable behaviour.

#### arena

The properties that can be set on this component are:

- x: The width of the arena in blocks.  Typically 5 for 3D games, 10 for 2D games, though other values can be set.
- z: The depth of the arena in blocks.  Typically 5 for 3D games, 1 for 2D games, though other values can be set.  The arena must be deep enough (and wide enough) to allow for all shapes configured on the shapegenerator to spawn within the bounds of the arena.  Problems will arise if you configure the shapegenerator to spawn shapes that are 2 blocks deep in an arena that's one block deep.

The element assigned the shapegenerator component must also have the following A-Frame properties set.

- An id.  This must match what is configured on tertrisgame & shapegenerator.
- A position.   This should be below the shapegenerator, with enough room for all configured shapes to spawn at the shape generator and be entirely within the x-z boundaries of the arena.  Recommendation is to set the shape dropper at the x-z center of the arena, about 1.5m to 2m (15 to 20 blocks) above.
  - However, the blocks that make up the arena should be aligned with the blocks that the shape dropper generates.
  - To ensure this, whenever the arena has an *even* dimension of blocks (and therefore no center block), the arena should be offset by half a block-width (i.e. 5cm) from the shape dropper.
    - For example: if the arena is 10 blocks wide, the "middle" of the arena is between blocks 5 & 6, so it's not a position where a block can be spawned.  To avoid this mis-alignment, offset the arena by half a block relative to the shape dropper.
    - (if this is still not clear, see the examples, and compare the 3D (5 x 5) and 2D (1 x 10) arena configs.)

 A further strong recommendation is that the arena is an <a-plane> entity with rotation "-90 0 0" (i.e. lying flat in the xz plane), and that it's dimensions are set to match the configured arena size.  If these recommendations aren't met, there shouldn't be any issues for blocks-engine, which only cares about the arena position, but players experience will be poor if the arena shape does not match the configured arena dimensions.

#### Shape Definitions

As mentioned above, the configuration of which shapes to generate is defined on the shapedropper in the shapes property.

See the 2D 4-Blocks or 2D 5-Blocks Examples for some examples of this config.

The config consists of a comma-separated series of strings.  Each string represents a shape, and the strings look like EEE, EED or EDUE.

The shape definitions work as follows:

- Every shape consists of at least one block.
- After the first block, the letters in the shape string provide a set of directions to move in to spawn the next block.
- Directions are:
  - E,W : -ve & +ve x axis. (East & West)
  - N,S : -ve & +ve z axis. (North & South)
  - U, D: +ve & -ve y axis.
- There are many ways to define a single shape.  The following are all equivalent:
  - EEE, WWW, EEWWEEE.
- It's OK for shape definitions to double back on themselves.  That's needed to create e.g. a T block.  The shape generator just eliminates duplicate blocks.
- The shape generator automatically calculates the center of mass of the block, and recenters based on that (to the nearest block).
- The shape definition does affect the rotation of the block at the point it spawns, so EEE would spawn a horizontal 4-bar aligned with the x-axis, whereas UUU would spawn a vertical one, and NNN would spawn one aligned with the z-axis.
- Where one shape can be rotated to form another, recommended practice is to only include one of the shapes - that would match the traditional experience.  But if you wanted to give a different experience, you could define all of EEE, UUU and NNN, and you'd get 4-bars spawning in 3 different orientations.
- Note that whether one shape can be rotated into another depends on the arena size.  For example with 2D 4-Blocks the L and S shapes come in left-handed and right-handed forms that can't be rotated into each other.  But with 3D 4-Blocks these shapes can be swapped by rotation in the y-axis.  So for 3D 4-Blocks, we only have one type of L block, and one type of S block (we have some interesting new 3D shapes to make up for it, though!).
  - Ultimately, all this is controlled through config, and if you wanted to have both types of S block & both types of L block in 3D , you could configure it that way.

What about colors?

- Eventually, colors will be configurable (and we'll offer customizable textures etc. as well).  For now, shapes are assigned colors in the order they are configured in the shapes property.  We have 14 colors (the game won't work if you try to configure more than 14 shapes).
- The colors (in order) are: 
  - Yellow, Blue, White, Magenta, Cyan, Green, Red, Grey, Orange, Hot Pink, Lime Green, Mint Green, Indigo, Azure.
  - Hex codes: FF0, 00F, FFF, F0F, 0FF, 0F0, F00, 888, F80, F08, 8F0, 0F8, 80F, 08F.

#### General Warning on Component Config

There are lots of ways to misconfigure components, and very little in the way of checking code for the config provided.

If you misconfigure components, the very likely outcome is that the javascript will exit, and the game will not even start.  At this stage, you're not likely to get a helpful error message, just an exception somewhere further down the line.

If your game doesn't start, the best way forwards is to double check all the config you have set up, and compare it against the example HTML files (assuming that these are working for you).

This is an area where I hope we can get better over time.



### Limitations

This project is at a *very* early stage of development.

The headline promise is that: "With just a few lines of HTML, you can put a falling blocks game into any A-Frame VR world."

In reality we're not there yet...  The code is still at a very early alpha stage.

Biggest limitations to be aware of:

- This has only been tested on Oculus Quest 2 (and even then only tested a bit).  Performance on other VR headsets, and with other VR controllers is unknown.

- Since this is at a very early stage of development, there will be bugs, and there will be interface changes.

- Customization is limited - as detailed above.

- As explained above, behaviour on receipt of bad config from HTML is almost always a non-graceful failure, without clear info on the misconfiguration.

- Currently, almost zero automated testing for this repo, so significant risk of regressions as new function is developed.

  

### Acknowledgments

Starry sky background for "Space Balls" 2D 4-Blocks customization is based on a photo from Andy Holmes, https://unsplash.com/@andyjh07. 

https://unsplash.com/photos/rCbdp8VCYhQ

Planetary textures from Solar System Scope: https://www.solarsystemscope.com/textures/

