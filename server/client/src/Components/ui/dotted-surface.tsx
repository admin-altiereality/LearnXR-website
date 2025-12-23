import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';
import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface DottedSurfaceProps extends Omit<React.ComponentProps<'div'>, 'ref'> {
	/** Whether the loading animation is active */
	isLoading?: boolean;
	/** Color scheme variant */
	variant?: 'default' | 'purple' | 'cyan' | 'aurora';
	/** Interaction intensity (0-1) */
	interactionStrength?: number;
}

export function DottedSurface({ 
	className, 
	isLoading = false, 
	variant = 'aurora',
	interactionStrength = 0.8,
	...props 
}: DottedSurfaceProps) {
	const { theme } = useTheme();
	const containerRef = useRef<HTMLDivElement>(null);
	const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
	const isLoadingRef = useRef(isLoading);
	
	// Update loading ref when prop changes
	useEffect(() => {
		isLoadingRef.current = isLoading;
	}, [isLoading]);

	const sceneRef = useRef<{
		scene: THREE.Scene;
		camera: THREE.PerspectiveCamera;
		renderer: THREE.WebGLRenderer;
		points: THREE.Points;
		animationId: number;
		count: number;
		geometry: THREE.BufferGeometry;
		material: THREE.PointsMaterial;
	} | null>(null);

	// Get color based on variant
	const getColors = useCallback(() => {
		const isDark = theme === 'dark';
		switch (variant) {
			case 'purple':
				return {
					primary: isDark ? 0x8b5cf6 : 0x7c3aed,
					secondary: isDark ? 0xec4899 : 0xdb2777,
				};
			case 'cyan':
				return {
					primary: isDark ? 0x06b6d4 : 0x0891b2,
					secondary: isDark ? 0x10b981 : 0x059669,
				};
			case 'aurora':
				return {
					primary: isDark ? 0x8b5cf6 : 0x6366f1,
					secondary: isDark ? 0x06b6d4 : 0x0ea5e9,
				};
			default:
				return {
					primary: isDark ? 0xaaaaaa : 0x444444,
					secondary: isDark ? 0x666666 : 0x888888,
				};
		}
	}, [theme, variant]);

	useEffect(() => {
		if (!containerRef.current) return;

		const SEPARATION = 100;
		const AMOUNTX = 50;
		const AMOUNTY = 50;

		// Scene setup
		const scene = new THREE.Scene();

		const camera = new THREE.PerspectiveCamera(
			75,
			window.innerWidth / window.innerHeight,
			1,
			10000,
		);
		camera.position.set(0, 300, 800);
		camera.lookAt(0, 0, 0);

		const renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true,
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setClearColor(0x000000, 0);
		renderer.domElement.style.position = 'absolute';
		renderer.domElement.style.top = '0';
		renderer.domElement.style.left = '0';
		renderer.domElement.style.width = '100%';
		renderer.domElement.style.height = '100%';

		containerRef.current.appendChild(renderer.domElement);

		// Create particles with colors
		const positions: number[] = [];
		const colors: number[] = [];
		const scales: number[] = [];

		const { primary, secondary } = getColors();
		const primaryColor = new THREE.Color(primary);
		const secondaryColor = new THREE.Color(secondary);

		// Create geometry
		const geometry = new THREE.BufferGeometry();

		for (let ix = 0; ix < AMOUNTX; ix++) {
			for (let iy = 0; iy < AMOUNTY; iy++) {
				const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
				const y = 0;
				const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

				positions.push(x, y, z);

				// Gradient colors based on position
				const t = (ix + iy) / (AMOUNTX + AMOUNTY);
				const color = primaryColor.clone().lerp(secondaryColor, t);
				colors.push(color.r, color.g, color.b);
				
				scales.push(1);
			}
		}

		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
		geometry.setAttribute('scale', new THREE.Float32BufferAttribute(scales, 1));

		// Create shader material for glow effect
		const material = new THREE.PointsMaterial({
			size: 4,
			vertexColors: true,
			transparent: true,
			opacity: 0.85,
			sizeAttenuation: true,
			blending: THREE.AdditiveBlending,
		});

		// Create points
		const points = new THREE.Points(geometry, material);
		scene.add(points);

		let count = 0;
		let animationId: number;
		let pulsePhase = 0;

		// Animation function with mouse interaction
		const animate = () => {
			animationId = requestAnimationFrame(animate);

			// Smooth mouse following
			mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
			mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

			const positionAttribute = geometry.attributes.position;
			const colorAttribute = geometry.attributes.color;
			const posArray = positionAttribute.array as Float32Array;
			const colorArray = colorAttribute.array as Float32Array;

			// Update pulse phase for loading effect
			if (isLoadingRef.current) {
				pulsePhase += 0.08;
			} else {
				pulsePhase += 0.02;
			}

			let i = 0;
			for (let ix = 0; ix < AMOUNTX; ix++) {
				for (let iy = 0; iy < AMOUNTY; iy++) {
					const index = i * 3;

					// Base wave animation
					let yPos = Math.sin((ix + count) * 0.3) * 50 + Math.sin((iy + count) * 0.5) * 50;

					// Mouse interaction - create ripple effect
					const particleX = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
					const particleZ = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
					
					const dx = (mouseRef.current.x * AMOUNTX * SEPARATION) - particleX;
					const dz = (mouseRef.current.y * AMOUNTY * SEPARATION) - particleZ;
					const distance = Math.sqrt(dx * dx + dz * dz);
					const maxDist = 1500;
					
					if (distance < maxDist) {
						const influence = (1 - distance / maxDist) * interactionStrength;
						yPos += Math.sin(distance * 0.01 - count * 2) * 80 * influence;
					}

					// Loading pulse effect - radiating waves from center
					if (isLoadingRef.current) {
						const centerDist = Math.sqrt(particleX * particleX + particleZ * particleZ);
						const wave = Math.sin(centerDist * 0.008 - pulsePhase * 2) * 30;
						yPos += wave;
						
						// Color pulsing during loading
						const colorPulse = (Math.sin(pulsePhase + centerDist * 0.005) + 1) * 0.5;
						const t = (ix + iy) / (AMOUNTX + AMOUNTY);
						
						// Interpolate between primary and a brighter version
						const baseColor = primaryColor.clone().lerp(secondaryColor, t);
						const brightColor = baseColor.clone().multiplyScalar(1.5 + colorPulse * 0.5);
						
						colorArray[index] = THREE.MathUtils.lerp(baseColor.r, brightColor.r, colorPulse);
						colorArray[index + 1] = THREE.MathUtils.lerp(baseColor.g, brightColor.g, colorPulse);
						colorArray[index + 2] = THREE.MathUtils.lerp(baseColor.b, brightColor.b, colorPulse);
					} else {
						// Normal color with subtle animation
						const t = (ix + iy) / (AMOUNTX + AMOUNTY);
						const timeOffset = Math.sin(count * 0.5 + ix * 0.1 + iy * 0.1) * 0.1;
						const color = primaryColor.clone().lerp(secondaryColor, t + timeOffset);
						
						colorArray[index] = color.r;
						colorArray[index + 1] = color.g;
						colorArray[index + 2] = color.b;
					}

					posArray[index + 1] = yPos;
					i++;
				}
			}

			positionAttribute.needsUpdate = true;
			colorAttribute.needsUpdate = true;

			// Dynamic size based on loading state
			material.size = isLoadingRef.current 
				? 4 + Math.sin(pulsePhase * 2) * 1.5 
				: 4;

			// Subtle camera movement
			camera.position.x = Math.sin(count * 0.1) * 50;
			camera.position.y = 300 + Math.sin(count * 0.15) * 30;
			camera.lookAt(0, 0, 0);

			renderer.render(scene, camera);
			count += 0.05;
		};

		// Mouse move handler
		const handleMouseMove = (event: MouseEvent) => {
			mouseRef.current.targetX = (event.clientX / window.innerWidth) - 0.5;
			mouseRef.current.targetY = (event.clientY / window.innerHeight) - 0.5;
		};

		// Handle window resize
		const handleResize = () => {
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(window.innerWidth, window.innerHeight);
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleMouseMove);

		// Start animation
		animate();

		// Store references
		sceneRef.current = {
			scene,
			camera,
			renderer,
			points,
			animationId,
			count,
			geometry,
			material,
		};

		// Cleanup function
		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('mousemove', handleMouseMove);

			if (sceneRef.current) {
				cancelAnimationFrame(sceneRef.current.animationId);
				sceneRef.current.geometry.dispose();
				sceneRef.current.material.dispose();
				sceneRef.current.renderer.dispose();

				if (containerRef.current && sceneRef.current.renderer.domElement) {
					containerRef.current.removeChild(sceneRef.current.renderer.domElement);
				}
			}
		};
	}, [theme, variant, getColors, interactionStrength]);

	return (
		<div
			ref={containerRef}
			className={cn('fixed inset-0', className)}
			{...props}
		/>
	);
}
