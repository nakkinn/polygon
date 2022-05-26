points = [
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(1, -1, 0),
    new THREE.Vector3(-1,-1,0),
    new THREE.Vector3(-1,1,0)
]
geometry = new THREE.BufferGeometry().setFromPoints( points )
segments = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color: 0x000000}))

uscene=new UScene()
uscene.UMainObject.add(segments)