class Bullet {
    constructor(scene, position, direction) {
        // Create simple bullet
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xffff00,
            emissive: 0xffaa00,
            emissiveIntensity: 0.5
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.direction = direction.clone().normalize();
        this.speed = 400;
        this.alive = true;
        this.lifetime = 2.0;

        scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.alive) return;

        // Update lifetime
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.alive = false;
            return;
        }

        // Update position
        this.mesh.position.x += this.direction.x * this.speed * deltaTime;
        this.mesh.position.y += this.direction.y * this.speed * deltaTime;
        this.mesh.position.z += this.direction.z * this.speed * deltaTime;
    }
} 