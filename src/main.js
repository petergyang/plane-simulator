class PlaneSimulator {
    constructor() {
        console.log('Initializing PlaneSimulator');

        // Move mobile detection to very start
        this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        console.log('Device detected as:', this.isMobile ? 'Mobile' : 'Desktop');

        // Touch control state
        this.touchControl = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        // Initialize arrays first
        this.buildings = [];
        this.enemies = [];
        this.blimps = [];

        // Set up scene
        this.scene = new THREE.Scene();
        
        // Set up camera with better initial position
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            5000  // Increased back to 5000 since we removed fog
        );

        // Set up renderer with shadow support
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        document.body.appendChild(this.renderer.domElement);

        // Add stronger lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Increased intensity
        this.scene.add(ambientLight);
        
        // Improve directional light for better shadows
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(300, 400, 300);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;  // Increased resolution
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 2000;
        directionalLight.shadow.camera.left = -1000;
        directionalLight.shadow.camera.right = 1000;
        directionalLight.shadow.camera.top = 1000;
        directionalLight.shadow.camera.bottom = -1000;
        directionalLight.shadow.bias = -0.001; // Reduce shadow artifacts
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

        // Set up controls based on device
        this.setupControls();

        // Start game loop
        this.lastTime = 0;
        
        // Force initial render
        this.renderer.render(this.scene, this.camera);
        
        // Don't start animation loop automatically
        this.paused = true;
        this.showStartScreen();

        // Add window resize handler
        window.addEventListener('resize', () => this.handleResize());

        console.log('Initialization complete');

        this.gameStarted = false;  // Add flag to track if game has started
        this.initialEnemyCount = 5;
        this.initialBlimpCount = 5;
        this.enemiesDestroyed = 0;
        this.blimpsDestroyed = 0;
        
        this.score = 0;
        this.gameOver = false;
        this.victory = false;

        this.spawnBlimps();
        this.spawnEnemies();

        // Setup music
        this.music = document.getElementById('bgMusic');
        this.music.volume = 0.3; // Set initial volume to 30%
    }

    setupControls() {
        if (this.isMobile) {
            console.log('Setting up mobile controls');
            
            // Add touch controls to the whole window
            window.addEventListener('touchstart', (e) => {
                console.log('Touch start detected');
                const touch = e.touches[0];
                this.touchControl.active = true;
                this.touchControl.startX = touch.clientX;
                this.touchControl.startY = touch.clientY;
                this.touchControl.currentX = touch.clientX;
                this.touchControl.currentY = touch.clientY;
            }, { passive: true });

            window.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                this.touchControl.currentX = touch.clientX;
                this.touchControl.currentY = touch.clientY;
            }, { passive: true });

            window.addEventListener('touchend', () => {
                console.log('Touch end detected');
                this.touchControl.active = false;
            });

        } else {
            // Existing keyboard controls
            document.addEventListener('keydown', (e) => {
                switch(e.key.toLowerCase()) {
                    case 'e': this.input.throttleUp = true; break;
                    case 'q': this.input.throttleDown = true; break;
                    case 'w': this.input.pitchUp = true; break;
                    case 's': this.input.pitchDown = true; break;
                    case 'a': this.input.turnLeft = true; break;
                    case 'd': this.input.turnRight = true; break;
                    case ' ': this.input.shootMissile = true; break;
                    case 'b': this.triggerMegaBomb(); break;
                }
            });

            document.addEventListener('keyup', (e) => {
                switch(e.key.toLowerCase()) {
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
    }

    updateMobileControls() {
        if (!this.isMobile) return;

        // Set constant speed (same as desktop default)
        this.airplane.velocity = 100;
        
        // Always auto-fire on mobile
        this.input.shootMissile = true;

        if (!this.touchControl.active) {
            // Reset steering controls when not touching
            this.input.turnLeft = false;
            this.input.turnRight = false;
            this.input.pitchUp = false;
            this.input.pitchDown = false;
            return;
        }

        // Calculate drag distances
        const dx = this.touchControl.currentX - this.touchControl.startX;
        const dy = this.touchControl.currentY - this.touchControl.startY;

        // More responsive touch controls
        const sensitivity = 1; // Increased sensitivity (was 2)
        
        // Use relative movement for smoother control
        this.input.turnLeft = dx < -sensitivity;
        this.input.turnRight = dx > sensitivity;
        this.input.pitchUp = dy < -sensitivity;
        this.input.pitchDown = dy > sensitivity;

        // Update reference position for next frame
        this.touchControl.startX = this.touchControl.currentX;
        this.touchControl.startY = this.touchControl.currentY;

        // Don't use throttle controls on mobile
        this.input.throttleUp = false;
        this.input.throttleDown = false;
    }

    updateHUD() {
        const hud = document.getElementById('hud');
        if (this.isMobile) {
            hud.innerHTML = `Score: ${this.score}

Touch and drag anywhere to steer
Auto-firing enabled`;
            hud.style.fontSize = '24px'; // Larger text for mobile
        } else {
            hud.innerHTML = `Score: ${this.score}

Controls:
W/S - Pitch
A/D - Turn
Q/E - Speed
SPACE - Fire`;
        }
    }

    animate(currentTime = 0) {
        if (this.paused) return;
        if (!this.scene || !this.camera) {
            console.error('Scene or camera not initialized');
            return;
        }

        if (this.gameOver || this.victory) return;

        requestAnimationFrame((time) => this.animate(time));

        const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        // Update mobile controls BEFORE updating airplane
        if (this.isMobile) {
            this.updateMobileControls();
        }

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

        // Update blimps
        this.blimps.forEach(blimp => {
            blimp.update(deltaTime);
        });

        // Check bullet collisions with both enemies and buildings
        this.airplane.bullets.forEach(bullet => {
            // Check enemy collisions
            this.enemies.forEach(enemy => {
                if (enemy.checkBulletCollision(bullet)) {
                    this.gameStarted = true;  // Game has started when first shot hits
                    enemy.hit();
                    bullet.alive = false;
                    if (!enemy.alive) {
                        this.score += 3;
                        this.enemiesDestroyed++;
                    }
                }
            });

            // Check building collisions
            this.buildings.forEach(building => {
                if (building.checkBulletCollision(bullet)) {
                    building.hit();
                    bullet.alive = false;
                    if (!building.alive) {
                        this.score -= 1; // -1 point for destroying building
                    }
                }
            });

            // Check blimp collisions
            this.blimps.forEach(blimp => {
                if (blimp.checkBulletCollision(bullet)) {
                    this.gameStarted = true;  // Game has started when first shot hits
                    blimp.hit();
                    bullet.alive = false;
                    if (!blimp.alive) {
                        this.score += 1;
                        this.blimpsDestroyed++;
                    }
                }
            });
        });

        // Clean up dead enemies and destroyed buildings
        this.enemies = this.enemies.filter(enemy => {
            if (!enemy.alive) {
                this.scene.remove(enemy.mesh);
            }
            return enemy.alive;
        });
        this.buildings = this.buildings.filter(building => building.alive);
        this.blimps = this.blimps.filter(blimp => {
            if (!blimp.alive) {
                this.scene.remove(blimp.mesh);
            }
            return blimp.alive;
        });

        // Check for plane collision with buildings
        this.buildings.forEach(building => {
            if (this.checkPlaneCollision(building)) {
                this.handleCrash();
            }
        });

        // Check for victory condition - only when game has started and all aircraft are destroyed
        if (!this.victory && !this.gameOver && this.gameStarted && 
            this.enemiesDestroyed === this.initialEnemyCount && 
            this.blimpsDestroyed === this.initialBlimpCount) {
            this.showVictoryScreen();
        }

        // Update HUD
        this.updateHUD();

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    checkPlaneCollision(building) {
        if (!building.alive) return false;

        const planePos = this.airplane.mesh.position;
        const buildingPos = building.mesh.position;
        
        // Simple point collision check with building bounds
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

        this.music.pause(); // Stop music on crash
    }

    showVictoryScreen() {
        this.victory = true;
        
        // Create and show victory screen
        const victoryScreen = document.createElement('div');
        victoryScreen.style.cssText = `
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

        const victoryText = document.createElement('h1');
        victoryText.textContent = "You've saved the day!";
        victoryText.style.fontSize = '48px';
        victoryText.style.marginBottom = '20px';
        victoryText.style.color = '#4CAF50'; // Victory green

        const scoreText = document.createElement('h2');
        scoreText.textContent = `Final Score: ${this.score || 0}`; // Add fallback to 0
        scoreText.style.fontSize = '32px';
        scoreText.style.marginBottom = '30px';
        scoreText.style.color = 'white'; // Make sure score is visible

        const restartButton = document.createElement('button');
        restartButton.textContent = 'Play Again';
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

        victoryScreen.appendChild(victoryText);
        victoryScreen.appendChild(scoreText);
        victoryScreen.appendChild(restartButton);
        document.body.appendChild(victoryScreen);

        this.music.pause(); // Stop music on victory
    }

    restartGame() {
        // Remove victory/crash screen
        document.querySelectorAll('div').forEach(div => {
            if (div.id !== 'hud') {
                div.remove();
            }
        });

        // Reset game state
        this.gameOver = false;
        this.victory = false;
        
        // Reset airplane to starting position outside city
        this.airplane.mesh.position.set(0, 200, 800);
        this.airplane.velocity = 100;
        this.airplane.altitude = 200;
        this.airplane.pitch = 0;
        this.airplane.roll = 0;
        this.airplane.heading = Math.PI; // Face city
        
        // Reset enemies and UFOs
        this.enemies.forEach(enemy => this.scene.remove(enemy.mesh));
        this.enemies = [];
        this.spawnEnemies();

        this.blimps.forEach(blimp => this.scene.remove(blimp.mesh));
        this.blimps = [];
        this.spawnBlimps();

        // Reset camera
        this.camera.position.set(0, 250, 900);
        this.camera.lookAt(this.airplane.mesh.position);

        // Reset counters
        this.gameStarted = false;  // Reset game started flag
        this.enemiesDestroyed = 0;
        this.blimpsDestroyed = 0;
        this.score = 0;

        // Restart music
        this.music.currentTime = 0;
        this.music.play();

        // Restart animation loop
        this.lastTime = 0;
        this.animate();
        this.paused = true;
        this.showStartScreen();
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
        const trunkGeometry = new THREE.BoxGeometry(2, 8, 2);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x4d2926 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 4;
        trunk.castShadow = true;
        trunk.receiveShadow = true;

        // Create larger leaves
        const leavesGeometry = new THREE.ConeGeometry(4, 12, 8);
        const leavesMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x0d5c0d,
            flatShading: true 
        });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 12;
        leaves.castShadow = true;
        leaves.receiveShadow = true;

        // Group trunk and leaves
        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(leaves);

        // Random rotation and scale
        tree.rotation.y = Math.random() * Math.PI * 2;
        const scale = 1.6 + Math.random() * 0.8;
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
        ground.receiveShadow = true; // Ground receives shadows
        this.scene.add(ground);
    }

    spawnEnemies() {
        // Spawn exactly 5 enemy planes around the city
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const radius = 300;
            const position = new THREE.Vector3(
                Math.cos(angle) * radius,
                250, // Higher height
                Math.sin(angle) * radius
            );
            this.enemies.push(new EnemyPlane(this.scene, position));
        }
    }

    spawnBlimps() {
        // Spawn exactly 5 UFOs (changed from 8)
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const height = 150 + Math.random() * 100;
            const position = new THREE.Vector3(
                Math.cos(angle) * 500,
                height,
                Math.sin(angle) * 500
            );
            this.blimps.push(new Blimp(this.scene, position));
        }
    }

    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }

    triggerMegaBomb() {
        const bombRadius = 200;
        const blastCenter = this.airplane.mesh.position.clone();

        this.gameStarted = true;

        // Check all objects within blast radius
        this.enemies.forEach(enemy => {
            const distance = enemy.mesh.position.distanceTo(blastCenter);
            if (distance < bombRadius && enemy.alive) {
                enemy.alive = false;
                this.enemiesDestroyed++;
                this.score += 3;
                enemy.createExplosion();
            }
        });

        this.blimps.forEach(blimp => {
            const distance = blimp.mesh.position.distanceTo(blastCenter);
            if (distance < bombRadius && blimp.alive) {
                blimp.alive = false;
                this.blimpsDestroyed++;
                this.score += 1;
                blimp.createExplosion();
            }
        });

        // Add building destruction with explosions
        this.buildings.forEach(building => {
            const distance = building.mesh.position.distanceTo(blastCenter);
            if (distance < bombRadius && building.alive) {
                building.alive = false;
                this.score -= 1;
                building.createExplosion(); // Create explosion effect
                this.scene.remove(building.mesh);
            }
        });

        // Create more dramatic explosion effect
        const explosionGeometry = new THREE.SphereGeometry(bombRadius, 32, 32);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: 0xff9933, // Orange color
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(blastCenter);
        this.scene.add(explosion);

        // Add inner bright core
        const coreGeometry = new THREE.SphereGeometry(bombRadius * 0.5, 32, 32);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.position.copy(blastCenter);
        this.scene.add(core);

        // Slower, more dramatic animation
        let size = 0.1;
        const animate = () => {
            if (size < 1) {
                size += 0.03; // Much slower expansion
                explosion.scale.set(size, size, size);
                core.scale.set(size * 0.5, size * 0.5, size * 0.5);
                
                // Fade out more gradually
                explosion.material.opacity = Math.max(0, 1.2 - size);
                core.material.opacity = Math.max(0, 1.5 - size * 2);
                
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(explosion);
                this.scene.remove(core);
                
                // Clean up destroyed objects
                this.enemies = this.enemies.filter(enemy => {
                    if (!enemy.alive) this.scene.remove(enemy.mesh);
                    return enemy.alive;
                });
                this.blimps = this.blimps.filter(blimp => {
                    if (!blimp.alive) this.scene.remove(blimp.mesh);
                    return blimp.alive;
                });
                this.buildings = this.buildings.filter(building => {
                    if (!building.alive) this.scene.remove(building.mesh);
                    return building.alive;
                });
            }
        };
        animate();
    }

    showStartScreen() {
        const startScreen = document.createElement('div');
        startScreen.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: Arial, sans-serif;
            z-index: 1000;
            text-align: center;
            padding: 20px;
        `;

        const title = document.createElement('h1');
        title.textContent = "City Under Attack!";
        title.style.fontSize = '48px';
        title.style.marginBottom = '20px';
        title.style.color = '#ff3333';

        const story = document.createElement('p');
        story.innerHTML = `Mysterious red aircraft have appeared over the city, threatening our safety and way of life. 
                          As the city's lone defender, you must destroy all 10 enemy aircraft while minimizing damage to civilian buildings.`;
        story.style.cssText = `
            font-size: 24px;
            margin-bottom: 40px;
            max-width: 800px;
            line-height: 1.5;
        `;

        const startButton = document.createElement('button');
        startButton.textContent = 'Start Mission';
        startButton.style.cssText = `
            padding: 15px 30px;
            font-size: 24px;
            background: #ff3333;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background 0.3s;
        `;
        startButton.onmouseover = () => startButton.style.background = '#ff4444';
        startButton.onmouseout = () => startButton.style.background = '#ff3333';
        startButton.onclick = () => this.startGame();

        startScreen.appendChild(title);
        startScreen.appendChild(story);
        startScreen.appendChild(startButton);
        document.body.appendChild(startScreen);
    }

    startGame() {
        console.log('Starting game, mobile:', this.isMobile);
        // Remove start screen
        document.querySelectorAll('div').forEach(div => {
            if (div.id !== 'hud') {
                div.remove();
            }
        });

        // Start the music
        this.music.play();

        // Start the game
        this.paused = false;
        this.lastTime = performance.now();
        this.animate();
    }
}

// Start the simulator
const simulator = new PlaneSimulator(); 