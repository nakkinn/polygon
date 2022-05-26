// Define a structure named SubMesh
// vertices: [[x,y,z],[x,y,z],...,[x,y,z]]
// faces: [[ordered vertex indices of face separated by commas],...,[ordered vertex indices of face separated by commas]]
// color: [r,g,b]
class USubMesh {
    constructor(parameters)
    {
        this.Vertices = []
        this.Faces = []
        this.Color = [1,1,1]
        this.Transparency = 1
        this.IsFlatShading = true
        this.SetValues(parameters)
    }

    SetValues(values) 
    {
        if (values === undefined) return
        for (const key in values) 
        {
            const newValue = values[key]
            if (newValue === undefined) continue
            const currentValue = this[key]
            if (currentValue === undefined) continue
            this[key] = newValue;
        }
    }
}

// Define a variable named ustyle, used to save user customizable property of each 3js scene and its canvas
uStyle = {}

// Structure of user customizable property of each 3js scene and its canvas
class UStyleProperty
{
    constructor(defaultValue)
    {
        this.DEFAULT_VALUE = defaultValue
        this.Value = this.DEFAULT_VALUE
    }

    set Value(value)
    {
        this.LastValue = this.Value
        this._value = value ?? this.LastValue
    }

    get Value()
    {
        return this._value
    }
}

// manager to deal with data of user customizable property of each 3js scene and its canvas
class UStyleReader
{
    constructor()
    {
        // Declare user customizable properties with a default value
        this.Width = new UStyleProperty(500)
        this.Height = new UStyleProperty(500)
        this.Side = new UStyleProperty('both')
        this.Background = new UStyleProperty([0.95,1.0,0.9])
        this.Projection = new UStyleProperty('persp')
        this.Wireframe = new UStyleProperty(true)
        this.Scale = new UStyleProperty(1)  //変更（追加）最初の文字だけ大文字にする
        this.Initialangularvelocity = new UStyleProperty([0,0,0]) //変更（追加）
        this.Initialrotatevelocity = new UStyleProperty(0)   //変更（追加） 角度
        this.Initialrotatevector = new UStyleProperty([1,0,0])  //変更（追加）回転軸
    }

    SetProps()
    {
        // set user customizable properties
        Object.keys(this).forEach((key) => {
            // set the uStyle property to its default value if the user commands
            if(uStyle.default === true)
            {
                uStyle[UUtil.ToCamelCase(key)] = this[key].DEFAULT_VALUE
            }

            // set current uStyleReader property according to its corresponding uStyle property
            this[key].Value = uStyle[UUtil.ToCamelCase(key)]
        })

        // reset commands in uStyle
        uStyle.default = false
    }
}
const uStyleReader = new UStyleReader()

// container to save property of single 3js scene and its canvas
class UProperties
{
    constructor()
    {
        uStyleReader.SetProps()
        
        this.Width = uStyleReader.Width.Value
        this.Height = uStyleReader.Height.Value

        this.MeshRenderSide = 0
        if(uStyleReader.Side.Value === 'front') this.MeshRenderSide = 0
        else if(uStyleReader.Side.Value === 'back') this.MeshRenderSide = 1
        else if(uStyleReader.Side.Value === 'both') this.MeshRenderSide = 2

        this.SceneBackgroundColor = uStyleReader.Background.Value
        this.targetscale = uStyleReader.Scale.Value //変更（追加）
        this.initialangularvelocity = uStyleReader.Initialangularvelocity.Value //変更（追加）
        this.initialrotatevelocity = uStyleReader.Initialrotatevelocity.Value   //変更（追加）
        this.initialrotatevector = uStyleReader.Initialrotatevector.Value   //変更（追加）


        this.CameraType = 0
        if(uStyleReader.Projection.Value === 'ortho') this.CameraType = 0
        else if(uStyleReader.Projection.Value === 'persp') this.CameraType = 1

        this.PerspCameraFov = 60 // the field of view(FOV) of perspective camera
        this.OrthoCameraSize = 100 // the field of view of orthographic camera

        this.HasWireframe = uStyleReader.Wireframe.Value
        this.WireframeThresholdAngle = 20 // detect an edge only if the angle between normal vector3 of two faces is bigger than the thresholdAngle
    }
}

class UInterface
{
    constructor(uMainObject)
    {
        // By dat.gui.js package, add a GUI control panel
        this.GUI = new dat.GUI({ autoPlace:false, width: 500 })
        this.GUI.domElement.style.cssText = 'position: relative';
        // Append the control panel below the canvas of graphics
        document.body.appendChild(this.GUI.domElement)

        // Add a slider into control panel to set the transparency factor
        this.TransparencyGUI = this.GUI.add(uMainObject, 'Transparency').min(0).max(1).listen()
        this.TransparencyGUI.onChange((value)=>{uMainObject.HasMeshChanged = true})

        // Add a toggle into control panel to set the visibility of edge
        this.HasWireframeGUI = this.GUI.add(uMainObject, 'HasWireframe').name('EdgeVisible').listen()
        this.HasWireframeGUI.onChange((value)=>{uMainObject.HasMeshChanged = true})

        // Add a slider into control panel to set the number of polygons to delete 
        // Calculate the number of the input polygon
        var faceNumber = uMainObject.USubMeshes.map(x=>x.Faces.length).reduce((p, c) => p + c, 0)
        this.DeleteNumberGUI = this.GUI.add(uMainObject, 'DeleteNumber').name('DeletePolygons').min(0).max(faceNumber).step(1).listen()
        this.DeleteNumberGUI.onChange((value)=>{uMainObject.HasMeshChanged = true})
        
    }
}


class UCamera extends THREE.Object3D
{
    constructor(width, height, perspCameraFov, orthoCameraSize)
    {
        super()
        this.position.z = 8
        this.CAMERA_NEAR_PLANE = 0.01
        this.CAMERA_FAR_PLANE = 500

        this.PerspCamera = new THREE.PerspectiveCamera(perspCameraFov, width/height, this.CAMERA_NEAR_PLANE, this.CAMERA_FAR_PLANE)
        this.OrthoCamera = new THREE.OrthographicCamera(-width/orthoCameraSize, width/orthoCameraSize, height/orthoCameraSize, -height/orthoCameraSize, this.CAMERA_NEAR_PLANE, this.CAMERA_FAR_PLANE)
        this.add(this.PerspCamera, this.OrthoCamera)
    }

    Update(deltaTime) {}
}

class ULight extends THREE.Object3D
{
    constructor()
    {
        super()

        let skyLightSkyColor = 0xeeddff
        let skyLightGroundColor = 0x999966
        let skyLightIntensity = 1

        let directionLightColor = 0xffffff
        let directionLightIntensity = 0.3
        let directionLightSoftness = 0.6

        this._skyLight = new THREE.HemisphereLight(skyLightSkyColor, skyLightGroundColor, skyLightIntensity)
        this._directionLight = new THREE.DirectionalLight(directionLightColor, directionLightIntensity, directionLightSoftness)
        this.add(this._skyLight)
        this.add(this._directionLight)

        this._time = 0
    }

    Update(deltaTime) 
    {
        this._time = (this._time + deltaTime * 0.1) % 2

        // Animate the sky light color from blue to orange
        this._skyLight.color.lerpColors(new THREE.Color(0.8,0.9,1.0,1.0), 
        new THREE.Color(1,1,0.5,0.5), THREE.MathUtils.pingpong(this._time))
    }
}

class UPhysics
{
    constructor(t, 
        mass = 1, 
        drag = 0.1, 
        angularDrag = 0.0, 
        initialVelocity = new THREE.Vector3(), 
        initialAngularVelocity = new THREE.Vector3()
        )
    {

        this.GameObject = t
        this.Mass = mass
        this.Drag = drag
        this.AngularDrag = angularDrag
        this.Velocity = initialVelocity
        this.AngularVelocity = initialAngularVelocity
        this.MINIMUM_LINEAR_SPEED = 1e-6
        this.MINIMUM_ROTATION_SPEED = 1e-6
        this.IsSleeping = true

    }

    Update(deltaTime)
    {
        if(this.Velocity.length() < this.MINIMUM_LINEAR_SPEED && 
        this.AngularVelocity.length() < this.MINIMUM_ROTATION_SPEED)
        {
            this.IsSleeping = true
        }
        else
        {
            this.IsSleeping = false
        }

        if (this.IsSleeping) {}
        else
        {
            this.GameObject.position.add(this.Velocity.clone().multiplyScalar(deltaTime))
            this.GameObject.rotateOnWorldAxis(UUtil.Normalize(this.AngularVelocity), this.AngularVelocity.length() * deltaTime)
            this.Velocity.lerp(new THREE.Vector3(), this.Drag * deltaTime)
            this.AngularVelocity.lerp(new THREE.Vector3(), this.AngularDrag * deltaTime)
        }
        
    }

    AddRelativeTorqueSmoothly(torque, smoothness)
    {
        this.AngularVelocity.lerp(torque.clone().multiplyScalar(1/this.Mass), smoothness)
    }
}

class UMainObject extends THREE.Object3D
{
    constructor(uInputReader, meshRenderSide, hasWireframe, wireframeThresholdAngle, targetScale, initialAngularVelocity, initialRotateVelocity, initialRotateVector)   //変更
    {
        super()

        this.USubMeshes = []
        this.Geometry = new THREE.BufferGeometry()
        this.HasMeshChanged = false
        this.HasWireframe = hasWireframe
        this.WireframeThresholdAngle = wireframeThresholdAngle
        this.MeshRenderSide = meshRenderSide

        this.Transparency = 1
        this.DeleteNumber = 0

        this.UPhysics = new UPhysics(this)
        
        let x=initialRotateVector[0],y=initialRotateVector[1],z=initialRotateVector[2];   //変更（追加）
        this.UPhysics.GameObject.rotateOnWorldAxis(new THREE.Vector3(x,y,z),initialRotateVelocity); //変更（追加）
        let v = new THREE.Vector3(initialAngularVelocity[0],initialAngularVelocity[1],initialAngularVelocity[2])    //変更（追加）
        this.UPhysics.AngularVelocity = v;  //変更
        this.TargetScale = targetScale  //変更　スケールが変わる

        this.MOUSEMOVE_SCALAR = 0.5
        this.MOUSEWHEEL_SCALAR = 0.0005
        
        this._uInputReader = uInputReader
        this._materials = []
        this._mesh = new THREE.Mesh(this.Geometry, this._materials)
        this._wireframe = new THREE.Object3D()
        
        this.add(this._mesh, this._wireframe)

    }

    ResetMesh()
    {
        this.Geometry.clearGroups()

        let meshVertices = []
        let meshIndices = []
        
        let submeshIdx = 0
        let submeshIndicesStartIdx = 0
        let faceNumber = this.USubMeshes.map(x=>x.Faces.length).reduce((p, c) => p + c, 0) - this.DeleteNumber
        let faceCount = 0
        this.USubMeshes.forEach((submesh) => {
            submesh.Faces.forEach((face)=>{
                if(faceCount < faceNumber)
                {
                    for(let i = 1; i < face.length - 1; i++) {
                        let triangleIndices = [face[0], face[i], face[i + 1]]
                        meshIndices.push(...triangleIndices.flat().map(x=>x+(meshVertices.length/3)))
                    }
                }
                faceCount++
            })
            meshVertices.push(...submesh.Vertices.flat())
            // Assign properties to submesh
            if(submeshIdx < this._materials.length)
            {
                this._mesh.material[submeshIdx].opacity = this.Transparency * submesh.Transparency
            }
            else
            {
                this._materials.push( 
                    new THREE.MeshStandardMaterial( 
                        {
                            color: UUtil.ParseColor(submesh.Color), 
                            side: this.MeshRenderSide,
                            depthTest: true,
                            transparent: true, 
                            opacity: this.Transparency * submesh.Transparency,
                            flatShading: true,
                        }
                    )
                )
            }
            this.Geometry.addGroup(submeshIndicesStartIdx, meshIndices.length - submeshIndicesStartIdx, submeshIdx++)
            submeshIndicesStartIdx = meshIndices.length

        })
        
        // Pass the array to the geometric information storage object
        this.Geometry.setIndex(meshIndices)
        this.Geometry.setAttribute('position', new THREE.Float32BufferAttribute( meshVertices, 3 ))
        this.Geometry.attributes.position.needsUpdate = true; // required after the first render
        // Calculate the normal vector at each vertex for shading
        this.Geometry.computeVertexNormals()
        
    }

    ResetWireframe()
    {
        this.remove(this._wireframe)

        this._wireframe = new THREE.LineSegments( 
            new THREE.EdgesGeometry( this.Geometry , this.WireframeThresholdAngle), 
            new THREE.LineBasicMaterial({color: 0x000000}))
        this._wireframe.visible = this.HasWireframe

        this.add(this._wireframe)
    }

    Update(deltaTime)
    {
        if(this.HasMeshChanged) 
        {
            this.HasMeshChanged = false
            this.ResetMesh()
            this.ResetWireframe()
        }

        let k = THREE.MathUtils.clamp(10 * deltaTime, 0, 1)
        
        if(this._uInputReader.IsMouseDown)
        {
            this.UPhysics.AddRelativeTorqueSmoothly(
                new THREE.Vector3(
                    this._uInputReader.MouseMovementY,
                    this._uInputReader.MouseMovementX, 
                    0).multiplyScalar(this.MOUSEMOVE_SCALAR), k)
        }

        this.TargetScale += this._uInputReader.MouseMovementW * this.MOUSEWHEEL_SCALAR
        this.scale.lerp(new THREE.Vector3(1,1,1).multiplyScalar(this.TargetScale), k)

        this.UPhysics.Update(deltaTime)
    }
}

// a manager to save user inputs data of one frame
class UInputReader
{
    constructor()
    {
        this.IsMouseDown = false
        this.MouseMovementX = 0
        this.MouseMovementY = 0
        this.MouseMovementW = 0
    }

    Update()
    {
        this.MouseMovementX = 0
        this.MouseMovementY = 0
        this.MouseMovementW = 0
    }
}

// functions to set user input data by user input event
class UInput
{
    static OnMouseMove(event, uInputReader) 
    {
        if(uInputReader.IsMouseDown) 
        {
            uInputReader.MouseMovementX = event.movementX
            uInputReader.MouseMovementY = event.movementY
        }
    }

    static OnMouseWheel(event, uInputReader) 
    {
        event.preventDefault()
        uInputReader.MouseMovementW = event.wheelDelta
    }
}

class UScene extends THREE.Scene
{
    constructor() 
    {
        super()

        this.UProperties = new UProperties()
        this.UInputReader = new UInputReader()
        this.background = UUtil.ParseColor( this.UProperties.SceneBackgroundColor )

        // Make camera, light, and main object
        this.UCamera = new UCamera(this.UProperties.Width, this.UProperties.Height, this.UProperties.PerspCameraFov, this.UProperties.OrthoCameraSize)
        this.ULight = new ULight()
        this.UMainObject = new UMainObject(this.UInputReader, this.UProperties.MeshRenderSide, this.UProperties.HasWireframe, this.UProperties.WireframeThresholdAngle,
             this.UProperties.targetscale, this.UProperties.initialangularvelocity, this.UProperties.initialrotatevelocity, this.UProperties.initialrotatevector)   //変更
        
        // Put camera, light, and main object into this scene
        this.add(this.UCamera)
        this.add(this.ULight)
        this.add(this.UMainObject)

        // Make a canvas in html page used to put the rendered picture
        this.Canvas = document.createElement('canvas')
        this.Canvas.width = this.UProperties.Width
        this.Canvas.height = this.UProperties.Height
        document.body.appendChild(this.Canvas)

        // Make a renderer used to render this scene
        this.Renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, canvas: this.Canvas})
        this.Renderer.setPixelRatio( window.devicePixelRatio )
        this.Renderer.setSize( this.UProperties.Width, this.UProperties.Height )

        // Make a clock to manage time
        this.Clock = new THREE.Clock()
        
        // Set up mouse events
        this.Canvas.addEventListener('mousedown', () => this.UInputReader.IsMouseDown = true, false)
        this.Canvas.addEventListener('mouseup', () => this.UInputReader.IsMouseDown = false, false)
        this.Canvas.addEventListener('mousemove', (event) => UInput.OnMouseMove(event, this.UInputReader), false)
        this.Canvas.addEventListener('wheel', (event) => UInput.OnMouseWheel(event, this.UInputReader), false)
        
        // Execute animate function for this scene
        this.Update()
    }

    // Define function to add a new submesh into main object submeshes array
    AddGeometryData(vertices, faces, color = [1,0,0], transparency = 1)
    {
        this.UMainObject.USubMeshes.push(
            new USubMesh({
                Vertices: vertices,
                Faces: faces.map(face => face.map(idx => idx - 1)),
                Color: color,
                Transparency: transparency,
            }))

        // Tell the main object the mesh has changed
        this.UMainObject.HasMeshChanged = true
    }

    // Make a GUI control panel below the canvas of graphics
    AddControlPanel()
    {
        this.UInterface = new UInterface(this.UMainObject)
    }

    Update()
    {
        // Get the time difference between the current time and the time when this function was executed last time
        let deltaTime = this.Clock.getDelta()
        
        // Execute update functions for each object in this scene
        this.UMainObject.Update(deltaTime)
        this.ULight.Update(deltaTime)
        this.UCamera.Update(deltaTime)
        this.UInputReader.Update()

        // Renderer the scene
        if(this.UProperties.CameraType === 0)
        {
            // Render with ortho camera
            this.Renderer.render(this, this.UCamera.OrthoCamera)		
        } 
        else 
        {
            // Render with perspective camera
            this.Renderer.render(this, this.UCamera.PerspCamera)
        }

        requestAnimationFrame( () => this.Update() )
    }
}

// some useful functions
class UUtil
{
    // Scale object towards the target value
    // t : a THREE.Object3D to control
    // deltaTime : The time cost of one frame of animation
    static ToTarget(t, deltaTime, scale) 
    {
        // Make delay
        // k = 1 : Fixed update
        // 0 < k < 1 : Smooth update
        // k = 0 : Not update
        let k = 5 * deltaTime
        // Limit the value of k to between zero and one
        k = THREE.MathUtils.clamp(k,0,1) 
        t.scale.lerp(new THREE.Vector3(1,1,1).multiplyScalar(scale), k)
    }

    // t: an array with three number elements
    // return: a THREE.Color
    static ParseColor(t)
    {
        return new THREE.Color(t[0], t[1], t[2])
    }

    static Normalize(t)
    {
        return t.clone().normalize()
    }

    static ToCamelCase(string) 
    {
        return string.charAt(0).toLowerCase() + string.slice(1);
    }

    static ToPascalCase(string) 
    {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
}