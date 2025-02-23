class PlaneSimulator {
    constructor() {
        console.log('Initializing PlaneSimulator');
        // Initialize arrays first
        this.buildings = [];
        this.enemies = [];

        // Set up scene
        this.scene = new THREE.Scene();
        
        // Set up camera with better initial position
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            5000  // Increased back to 5000 since we removed fog
        );

        // Set up renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue
        document.body.appendChild(this.renderer.domElement);

        // Add stronger lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased intensity
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(100, 100, 100); // Move light further out
        this.scene.add(directionalLight);

        // Create ground first
        this.createTerrain();

        // Create environment
        this.createSky();
        this.createCity();
        this.createForest();

        // Create player airplane last, starting outside city facing inward
        this.airplane = new Airplane(this.scene);
        
        // Start 800 units south of city center
        this.airplane.mesh.position.set(0, 200, 800);
        // Set initial heading to face the city (north)
        this.airplane.heading = Math.PI;
        
        // Set up initial camera position behind plane
        this.camera.position.set(0, 250, 900);
        this.camera.lookAt(this.airplane.mesh.position);

        // Input state
        this.input = {
            throttleUp: false,
            throttleDown: false,
            pitchUp: false,
            pitchDown: false,
            turnLeft: false,
            turnRight: false,
            shootMissile: false
        };

        // Set up controls
        this.setupControls();

        // Start game loop
        this.lastTime = 0;
        
        // Force initial render
        this.renderer.render(this.scene, this.camera);
        
        // Start animation loop
        this.animate();

        // Add window resize handler
        window.addEventListener('resize', () => this.handleResize());

        console.log('Initialization complete');

        this.gameOver = false;
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'e': this.input.throttleUp = true; break;
                case 'q': this.input.throttleDown = true; break;
                case 'w': this.input.pitchUp = true; break;
                case 's': this.input.pitchDown = true; break;
                case 'a': this.input.turnLeft = true; break;
                case 'd': this.input.turnRight = true; break;
                case ' ': this.input.shootMissile = true; break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.key) {
                case 'e': this.input.throttleUp = false; break;
                case 'q': this.input.throttleDown = false; break;
                case 'w': this.input.pitchUp = false; break;
                case 's': this.input.pitchDown = false; break;
                case 'a': this.input.turnLeft = false; break;
                case 'd': this.input.turnRight = false; break;
                case ' ': this.input.shootMissile = false; break;
            }
        });
    }

    updateHUD() {
        const hud = document.getElementById('hud');
        const time = new Date();
        hud.innerHTML = `
Time: ${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}
Altitude: ${Math.round(this.airplane.altitude)} ft
Speed: ${Math.round(this.airplane.velocity)} km/h
Pitch: ${Math.round(this.airplane.pitch * 180 / Math.PI)}°
Roll: ${Math.round(this.airplane.roll * 180 / Math.PI)}°
Heading: ${Math.round(this.airplane.heading * 180 / Math.PI)}°
Wind: 29 km/h at 180°

Controls:
Q/E - Throttle Up/Down
A/D - Turn Left/Right
W/S - Pitch Up/Down
SPACE - Shoot Missiles
V - Toggle Camera View

Enemies Remaining: ${this.enemies.length}`;
    }

    animate(currentTime = 0) {
        if (!this.scene || !this.camera) {
            console.error('Scene or camera not initialized');
            return;
        }

        if (this.gameOver) return;

        requestAnimationFrame((time) => this.animate(time));

        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Update airplane
        this.airplane.control(this.input);
        this.airplane.update(deltaTime);

        // Update camera to follow behind plane
        const cameraDistance = 30;
        const cameraHeight = 15;
        
        const cameraX = this.airplane.mesh.position.x - Math.sin(this.airplane.heading) * cameraDistance;
        const cameraY = this.airplane.mesh.position.y + cameraHeight;
        const cameraZ = this.airplane.mesh.position.z - Math.cos(this.airplane.heading) * cameraDistance;
        
        this.camera.position.set(cameraX, cameraY, cameraZ);
        this.camera.lookAt(this.airplane.mesh.position);

        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(deltaTime);
        });

        // Check bullet collisions with both enemies and buildings
        this.airplane.bullets.forEach(bullet => {
            // Check enemy collisions
            this.enemies.forEach(enemy => {
                if (enemy.checkBulletCollision(bullet)) {
                    enemy.hit();
                    bullet.alive = false;
                }
            });

            // Check building collisions
            this.buildings.forEach(building => {
                if (building.checkBulletCollision(bullet)) {
                    building.hit();
                    bullet.alive = false;
                }
            });
        });

        // Clean up dead enemies and destroyed buildings
        this.enemies = this.enemies.filter(enemy => enemy.alive);
        this.buildings = this.buildings.filter(building => building.alive);

        // Spawn new enemies if all are destroyed
        if (this.enemies.length === 0) {
            this.spawnEnemies();
        }

        // Check for plane collision with buildings
        this.buildings.forEach(building => {
            if (this.checkPlaneCollision(building)) {
                this.handleCrash();
            }
        });

        // Update HUD
        this.updateHUD();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    checkPlaneCollision(building) {
        if (!building.alive) return false;

        const planePos = this.airplane.mesh.position;
        const buildingPos = building.mesh.position;
        
        // Simple box collision check
        return (
            planePos.x >= buildingPos.x - building.width/2 &&
            planePos.x <= buildingPos.x + building.width/2 &&
            planePos.y >= buildingPos.y - building.height/2 &&
            planePos.y <= buildingPos.y + building.height/2 &&
            planePos.z >= buildingPos.z - building.depth/2 &&
            planePos.z <= buildingPos.z + building.depth/2
        );
    }

    handleCrash() {
        // Stop the game loop
        this.gameOver = true;
        
        // Create and show crash screen
        const crashScreen = document.createElement('div');
        crashScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 1000;
        `;

        const crashText = document.createElement('h1');
        crashText.textContent = 'CRASHED!';
        crashText.style.fontSize = '48px';
        crashText.style.marginBottom = '20px';

        const restartButton = document.createElement('button');
        restartButton.textContent = 'Start New Game';
        restartButton.style.cssText = `
            padding: 15px 30px;
            font-size: 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.3s;
        `;
        restartButton.onmouseover = () => restartButton.style.background = '#45a049';
        restartButton.onmouseout = () => restartButton.style.background = '#4CAF50';
        restartButton.onclick = () => this.restartGame();

        crashScreen.appendChild(crashText);
        crashScreen.appendChild(restartButton);
        document.body.appendChild(crashScreen);
    }

    restartGame() {
        // Remove crash screen
        document.querySelectorAll('div').forEach(div => {
            if (div.id !== 'hud') {
                div.remove();
            }
        });

        // Reset game state
        this.gameOver = false;
        
        // Reset airplane to starting position outside city
        this.airplane.mesh.position.set(0, 200, 800);
        this.airplane.velocity = 100;
        this.airplane.altitude = 200;
        this.airplane.pitch = 0;
        this.airplane.roll = 0;
        this.airplane.heading = Math.PI; // Face city
        
        // Respawn enemies
        this.enemies.forEach(enemy => this.scene.remove(enemy.mesh));
        this.enemies = [];
        this.spawnEnemies();

        // Reset camera
        this.camera.position.set(0, 250, 900);
        this.camera.lookAt(this.airplane.mesh.position);

        // Restart animation loop
        this.lastTime = 0;
        this.animate();
    }

    createSky() {
        // Create sky dome
        const skyGeometry = new THREE.SphereGeometry(2500, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide,
            fog: false
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);

        // Create volumetric clouds
        const cloudCount = 30; // More clouds
        const cloudGeometry = new THREE.IcosahedronGeometry(40, 3); // More detailed geometry
        const cloudMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            metalness: 0,
            roughness: 1,
            emissive: 0xffffff,
            emissiveIntensity: 0.1
        });

        // Create cloud clusters
        for (let i = 0; i < cloudCount; i++) {
            const cloudCluster = new THREE.Group();
            const clusterSize = Math.random() * 5 + 3; // More sub-clouds per cluster
            
            // Create multiple meshes per cloud for fluffy effect
            for (let j = 0; j < clusterSize; j++) {
                const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
                
                // Random position within cluster with more vertical variation
                cloud.position.set(
                    (Math.random() - 0.5) * 60,
                    (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 60
                );
                
                // Random scale for more natural look
                const scale = Math.random() * 0.6 + 0.4;
                cloud.scale.set(scale, scale * 0.7, scale);
                
                // Random rotation for variety
                cloud.rotation.set(
                    Math.random() * Math.PI,
                    Math.random() * Math.PI,
                    Math.random() * Math.PI
                );
                
                cloudCluster.add(cloud);
            }

            // Position entire cluster (lower height)
            const radius = Math.random() * 1000 + 500;
            const angle = Math.random() * Math.PI * 2;
            const height = Math.random() * 100 + 250; // Changed from (200 + 400) to (100 + 250)
            
            cloudCluster.position.set(
                Math.cos(angle) * radius,
                height,
                Math.sin(angle) * radius
            );

            // Random cluster rotation
            cloudCluster.rotation.y = Math.random() * Math.PI;
            
            this.scene.add(cloudCluster);
        }
    }

    createForest() {
        const treeCount = 500;
        const forestRadius = 600;
        const cityRadius = 400; // Keep trees outside the city

        for (let i = 0; i < treeCount; i++) {
            const tree = this.createTree();
            let x, z;
            
            // Keep trying positions until we find one outside the city
            do {
                const angle = Math.random() * Math.PI * 2;
                const radius = cityRadius + Math.random() * (forestRadius - cityRadius);
                x = Math.cos(angle) * radius;
                z = Math.sin(angle) * radius;
            } while (this.isPositionInCity(x, z));

            tree.position.set(x, 0, z);
            this.scene.add(tree);
        }
    }

    createTree() {
        // Create larger trunk
        const trunkGeometry = new THREE.BoxGeometry(2, 8, 2); // Doubled size
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4d2926 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4; // Adjusted for new height

        // Create larger leaves
        const leavesGeometry = new THREE.ConeGeometry(4, 12, 8); // Doubled size
        const leavesMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x0d5c0d,
            flatShading: true 
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 12; // Adjusted for new height

        // Group trunk and leaves
        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(leaves);

        // Random rotation and larger scale range
        tree.rotation.y = Math.random() * Math.PI * 2;
        const scale = 1.6 + Math.random() * 0.8; // Doubled base scale (was 0.8 + random * 0.4)
        tree.scale.set(scale, scale, scale);

        return tree;
    }

    isPositionInCity(x, z) {
        // Check if position is within city bounds
        const citySize = 400;
        return Math.abs(x) < citySize && Math.abs(z) < citySize;
    }

    createCity() {
        // Make city slightly smaller to leave room for nature
        const citySize = 600;
        const blockSize = 40;
        const streetWidth = 20;

        for (let x = -citySize/2; x < citySize/2; x += blockSize + streetWidth) {
            for (let z = -citySize/2; z < citySize/2; z += blockSize + streetWidth) {
                // Create a block of buildings
                this.createCityBlock(x, z, blockSize);
            }
        }
    }

    createCityBlock(x, z, blockSize) {
        const buildingCount = Math.floor(Math.random() * 4) + 2;
        
        for (let i = 0; i < buildingCount; i++) {
            const building = this.createBuilding();
            
            // Position within block
            const offsetX = (Math.random() - 0.5) * (blockSize - building.width);
            const offsetZ = (Math.random() - 0.5) * (blockSize - building.depth);
            
            building.mesh.position.set(
                x + offsetX,
                building.height / 2, // Use building's height property
                z + offsetZ
            );
        }
    }

    createBuilding() {
        // Much more varied building sizes
        const type = Math.random(); // Determine building type
        let height, width, depth;
        
        if (type < 0.1) { // 10% chance for skyscrapers
            height = Math.random() * 150 + 100; // 100-250 units tall
            width = Math.random() * 10 + 15;
            depth = Math.random() * 10 + 15;
        } else if (type < 0.3) { // 20% chance for tall buildings
            height = Math.random() * 50 + 70; // 70-120 units tall
            width = Math.random() * 15 + 10;
            depth = Math.random() * 15 + 10;
        } else if (type < 0.7) { // 40% chance for medium buildings
            height = Math.random() * 30 + 40; // 40-70 units tall
            width = Math.random() * 20 + 15;
            depth = Math.random() * 20 + 15;
        } else { // 30% chance for small buildings
            height = Math.random() * 20 + 20; // 20-40 units tall
            width = Math.random() * 25 + 20;
            depth = Math.random() * 25 + 20;
        }
        
        const building = new Building(this.scene, width, height, depth);
        building.mesh.position.y = height / 2;
        this.buildings.push(building);
        return building;
    }

    createTerrain() {
        const groundSize = 3000;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 50, 50);
        
        // Create grass texture
        const textureSize = 1024; // Larger texture for more detail
        const canvas = document.createElement('canvas');
        canvas.width = textureSize;
        canvas.height = textureSize;
        const context = canvas.getContext('2d');
        
        // Base grass color
        context.fillStyle = '#2d5e1e';
        context.fillRect(0, 0, textureSize, textureSize);
        
        // Add grass detail
        for (let i = 0; i < 50000; i++) {
            const x = Math.random() * textureSize;
            const y = Math.random() * textureSize;
            const width = Math.random() * 3 + 1;
            const height = Math.random() * 4 + 2;
            
            // Vary grass blade colors
            const color = Math.random() < 0.5 ? '#3d7925' : '#1e4d12';
            context.fillStyle = color;
            context.fillRect(x, y, width, height);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(30, 30); // More repetitions for denser grass

        const groundMaterial = new THREE.MeshPhongMaterial({ 
            map: texture,
            side: THREE.DoubleSide
        });

        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        this.scene.add(ground);
    }

    spawnEnemies() {
        // Spawn 5 enemy planes around the city
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2; // Evenly space initial positions
            const radius = 300; // Start on patrol radius
            const position = new THREE.Vector3(
                Math.cos(angle) * radius,
                150, // Fixed height
                Math.sin(angle) * radius
            );
            this.enemies.push(new EnemyPlane(this.scene, position));
        }
    }

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
}

// Start the simulator
const simulator = new PlaneSimulator(); 