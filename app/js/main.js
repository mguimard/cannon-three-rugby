var SCREEN_WIDTH = window.innerWidth;
var SCREEN_HEIGHT = window.innerHeight;
var container, camera, scene, renderer,controls,stats;
var bars, bars2, ball, ballBody, player, playerBody;
var clock = new THREE.Clock();
var shootDirection = new THREE.Vector3();
var projector = new THREE.Projector();
var groundMaterial = new CANNON.Material(),
    ballMaterial = new CANNON.Material();
    


/**
* Cann js stuff
*/

// World
var timeStep = 1.0/60.0; // seconds
var world = new CANNON.World();
world.gravity.set(0,-9.82*8,0); // m/s²
world.broadphase = new CANNON.NaiveBroadphase();

// Create a plane for the field
var groundBody = new CANNON.Body({
    mass: 0, // mass == 0 makes the body static
    material:groundMaterial
});

var groundShape = new CANNON.Plane();
groundBody.addShape(groundShape);
groundBody.position.set(0,1,0); // m
world.add(groundBody);


ballBody = new CANNON.Body({ mass: 0.460 , material: ballMaterial}); 
world.add(ballBody); 


world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, ballMaterial, { friction: 0.4, restitution: 0.4 }));


/**
* Three js stuf
*/

init();
animate();

function createBars(){
    var combinedGeometry = new THREE.Geometry();
    var bargeometry = new THREE.CylinderGeometry( 1, 1, 100, 10 );
    var smallbargeometry = new THREE.CylinderGeometry( 1, 1, 32, 10 );

    var bar1 = bargeometry.clone();
    var bar2 = bargeometry.clone();   
    var bar3= smallbargeometry.clone();
    bar1.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,-17));
    bar2.applyMatrix(new THREE.Matrix4().makeTranslation(0,0,17));
    bar3.applyMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/2));
    bar3.applyMatrix(new THREE.Matrix4().makeTranslation(0,-30,0));
    combinedGeometry.merge(bar1);
    combinedGeometry.merge(bar2);
    combinedGeometry.merge(bar3);
    bars = new THREE.Mesh(combinedGeometry,new THREE.MeshBasicMaterial({color:'white'}));
    bars.position.set(-300, 50, 0);
    bars2 = bars.clone();
    bars2.position.set(300, 50, 0);
    scene.add(bars);
    scene.add(bars2);
}

function createField(){

    var img = new Image(), texture;
    img.crossOrigin = '';
    img.onload = function(){
        texture = new THREE.Texture(img);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;

        var ambient = 0x888888;
        var groundMaterial = new THREE.MeshLambertMaterial({
            //color: 0xFF0000,
            map: texture
            // ambient: ambient
        });

        plane = new THREE.Mesh(new THREE.PlaneGeometry(800, 500), groundMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.receiveShadow = true;
        plane.castShadow = false;

        scene.add(plane);
        groundBody.position.copy(plane.position);
        groundBody.quaternion.copy(plane.quaternion);
    };
    img.src = "res/field.png";

}

function getShootDir(targetVec){
    var vector = targetVec;
    targetVec.set(0,0,1);
    projector.unprojectVector(vector, camera);
    var ray = new THREE.Ray(camera.position, vector.sub(camera.position).normalize() );
    targetVec.x = ray.direction.x;
    targetVec.y = 1;
    targetVec.z = ray.direction.z;
}

function createBall(){
    var loader = new THREE.BinaryLoader();
    loader.load( "res/ball.js", function(ballGeometry){

        var texture = THREE.ImageUtils.loadTexture( "res/logo.jpg" );

        var material = new THREE.MeshPhongMaterial( { 
            ambient: 0x552811, 
            color: 0x552811, 
            specular: 0x333333, 
            shininess: 25
        });
  
        var scale = 0.02;
        ballGeometry.applyMatrix(new THREE.Matrix4().makeScale(scale,scale,scale));        

        ball = new THREE.Mesh(ballGeometry,material);            
        
        resetBall();      
       
        var rawVerts = ballGeometry.vertices ;
        var rawFaces = ballGeometry.faces;
        //var rawOffset = ballGeometry.offset;

        var verts=[], faces=[], offset;

        rawVerts.forEach(function(v){
             verts.push(new CANNON.Vec3().copy(v));
        });

        rawFaces.forEach(function(f){
             faces.push([f.a,f.b,f.c]);
        });

        // Construct polyhedron
        var ballPart = new CANNON.ConvexPolyhedron(verts,faces);

        // Add to compound
        ballBody.addShape(ballPart);

        // Create body
        ballBody.quaternion.copy(ball.quaternion);
              
        ball.castShadow = true;
        ball.receiveShadow = true;
        scene.add(ball);

    });
}


function updateObjects(){
    if(ball && ballBody){

        if(shooting){
            ballBody.position.z += wind.value / 100;
        }

        ball.position.copy(ballBody.position);
        ball.quaternion.copy(ballBody.quaternion);   
        controls.target.copy(ball.position);
    }
     
}
var shooting = false;

function shoot(){
    ball.rotateX(Math.PI/2);
    ball.rotateY(Math.PI/2);
    ball.rotateZ(Math.PI/2);
    ballBody.position.copy(ball.position);
    ballBody.quaternion.copy(ball.quaternion);

   shooting = true;
   getShootDir(shootDirection);
   ballBody.velocity.set(  shootDirection.x * shootVelo.value,
                           shootDirection.y * shootVelo.value * shootYAngle.value,
                           shootDirection.z * shootVelo.value);

   var bestViewPosition = new THREE.Vector3(-400,20,0);

   new TWEEN.Tween( camera.position )
            .to( bestViewPosition , 2000 )
            .easing( TWEEN.Easing.Quadratic.InOut )
            .onUpdate( function () {
                camera.position.copy(this)
            })
            .start();
}

function checkforGoal(){
    if(!ball || !shooting) return;
//         ballBody.position.copy(new THREE.Vector3(300,21.5,15.5))


    if(Math.abs(ball.position.x) > 300 && Math.abs(ball.position.z) < 15.5  && ball.position.y > 21.5){
        shooting = false;      
    }
}

function resetBall(){
    wind.value=0;
    shooting=false;
    ballBody.velocity.set(0,0,0);
    var x = - Math.random() *  200 ;
    var z = (0.5 - Math.random()) *  200 ;
    // var quat = new THREE.Quaternion();
    // quat.setFromRotationMatrix(new THREE.Matrix4().makeTranslation(x,0,z));

    ballBody.position.set(x,1.5,z);
    //ballBody.quaternion.copy(new THREE.Quaternion());
}

function init() {

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    // CAMERA

    camera = new THREE.PerspectiveCamera( 40, SCREEN_WIDTH / SCREEN_HEIGHT, 1, 10000 );
    camera.position.set(100,15,0)
   
    controls = new THREE.OrbitControls( camera , container);


    // SCENE

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog( 0xffffff, 1000, 10000 );

    // CONTROLS

    //controls = new THREE.OrbitControls( camera );

    // LIGHTS

    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.475 );
    directionalLight.position.set( 100, 100, -100 );
    scene.add( directionalLight );


    var hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 1.25 );
    hemiLight.color.setHSL( 0.6, 1, 0.75 );
    hemiLight.groundColor.setHSL( 0.1, 0.8, 0.7 );
    hemiLight.position.y = 500;
    scene.add( hemiLight );

    // SKYDOME

    var vertexShader = document.getElementById( 'vertexShader' ).textContent;
    var fragmentShader = document.getElementById( 'fragmentShader' ).textContent;
    var uniforms = {
        topColor:    { type: "c", value: new THREE.Color( 0x0077ff ) },
        bottomColor: { type: "c", value: new THREE.Color( 0xBBBBBB ) },
        offset:      { type: "f", value: 400 },
        exponent:    { type: "f", value: 0.6 }
    }
    uniforms.topColor.value.copy( hemiLight.color );

    scene.fog.color.copy( uniforms.bottomColor.value );

    var skyGeo = new THREE.SphereGeometry( 4000, 32, 15 );
    var skyMat = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        side: THREE.BackSide
    } );

    var sky = new THREE.Mesh( skyGeo, skyMat );
    scene.add( sky );

    // RENDERER

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setClearColor( scene.fog.color, 1 );
    renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
    renderer.domElement.style.position = "relative";
    container.appendChild( renderer.domElement );

    renderer.gammaInput = true;
    renderer.gammaOutput = true;

    createBars();
    createField();
    createBall();

    window.addEventListener( 'resize', onWindowResize, false );


    // STATS
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.zIndex = 100;
    container.appendChild( stats.domElement );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );

}

function lockBallInField(){
    if(!ball) return;
    if(Math.abs(ball.position.z) > 250 || Math.abs(ball.position.x) > 400){
        resetBall();
    }
}


function animate(time) {
    requestAnimationFrame( animate );   
    world.step(timeStep);
    updateObjects();
    lockBallInField();
    checkforGoal();
    TWEEN.update(time);
    controls.update();
    renderer.render( scene, camera );
    stats.update();
}




