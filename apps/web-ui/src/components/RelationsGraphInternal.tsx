'use client';

import React, { useRef, useEffect, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';

interface GraphNode {
  id: string;
  name: string;
  group: number;
  val: number;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  color: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface RelationsGraphProps {
  data: GraphData;
}

const RelationsGraphInternal: React.FC<RelationsGraphProps> = ({ data }) => {
  const fgRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (fgRef.current && data.nodes.length) {
      // Force configuration for an "organic neural" layout
      fgRef.current.d3Force('charge').strength(-500);
      fgRef.current.d3Force('link').distance(150);
      
      let angle = 0;
      const interval = setInterval(() => {
        if (!fgRef.current) return;
        fgRef.current.cameraPosition({
          x: 500 * Math.sin(angle),
          z: 500 * Math.cos(angle)
        });
        angle += Math.PI / 1500;
      }, 30);
      
      return () => clearInterval(interval);
    }
  }, [data]);

  const handleNodeClick = (node: GraphNode) => {
    const distance = 100;
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);

    const newPos = node.x || node.y || node.z
      ? { x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }
      : { x: 0, y: 0, z: distance };

    fgRef.current.cameraPosition(newPos, node, 3000);
  };

  return (
    <ForceGraph3D
      ref={fgRef}
      width={dimensions.width}
      height={dimensions.height}
      graphData={data}
      nodeLabel="name"
      nodeThreeObject={(node: any) => {
        // Node color mapping
        const color = node.group === 1 ? '#00e5ff' : node.group === 2 ? '#3b82f6' : node.group === 3 ? '#ef4444' : '#d946ef';
        
        // Group: Container for sphere + text
        const group = new THREE.Group();

        // 1. Biological/Cyber Node (Glowing Sphere)
        const geometry = new THREE.SphereGeometry(4, 24, 24);
        const material = new THREE.MeshLambertMaterial({ 
          color: color, 
          transparent: true, 
          opacity: 0.9,
          emissive: color,
          emissiveIntensity: 0.5
        });
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);

        // 2. Sprite Text Label
        const sprite = new SpriteText(node.name);
        sprite.color = '#ffffff';
        sprite.textHeight = 6;
        sprite.fontWeight = '800';
        sprite.fontFace = 'Courier New';
        sprite.backgroundColor = 'rgba(0,0,0,0.8)';
        sprite.padding = 1.5;
        sprite.borderRadius = 2;
        sprite.borderColor = color;
        sprite.borderWidth = 0.5;
        sprite.position.y = 10; // Position text above sphere
        group.add(sprite);

        return group;
      }}
      linkWidth={1.2}
      linkColor={(l: any) => l.color || '#333333'}
      linkDirectionalParticles={4}
      linkDirectionalParticleWidth={2.5}
      linkDirectionalParticleSpeed={0.008}
      linkDirectionalParticleColor={(l: any) => l.color || '#ffffff'}
      onNodeClick={handleNodeClick}
      backgroundColor="#0a0a0f"
      showNavInfo={false}
    />
  );
};

export default RelationsGraphInternal;

