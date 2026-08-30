'use client';

import { useRef, useEffect, useCallback } from 'react';
import styles from './AiAvatar.module.css';

interface AiAvatarProps {
  name: string;
  role?: string;
  color?: string;
  isSpeaking: boolean;
  analyserNode?: AnalyserNode | null;
}

export default function AiAvatar({ name, role, color = '#6366f1', isSpeaking, analyserNode }: AiAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const blinkRef = useRef({ timer: 0, isBlinking: false });
  const idleRef = useRef({ offset: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const faceRadius = Math.min(w, h) * 0.32;

    // Get audio amplitude
    let amplitude = 0;
    if (analyserNode && isSpeaking) {
      const data = new Uint8Array(analyserNode.fftSize);
      analyserNode.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      amplitude = Math.sqrt(sum / data.length) * 3;
      amplitude = Math.min(amplitude, 1);
    }

    // Idle animation
    idleRef.current.offset += 0.02;
    const idleBob = Math.sin(idleRef.current.offset) * 3;
    const idleTilt = Math.sin(idleRef.current.offset * 0.7) * 0.02;

    // Blink logic
    blinkRef.current.timer++;
    if (blinkRef.current.timer > 120 + Math.random() * 180) {
      blinkRef.current.isBlinking = true;
      blinkRef.current.timer = 0;
    }
    if (blinkRef.current.isBlinking && blinkRef.current.timer > 8) {
      blinkRef.current.isBlinking = false;
    }

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy + idleBob);
    ctx.rotate(idleTilt);

    // Glow when speaking
    if (isSpeaking) {
      const glowSize = faceRadius + 20 + amplitude * 15;
      const glow = ctx.createRadialGradient(0, 0, faceRadius, 0, 0, glowSize);
      glow.addColorStop(0, color + '40');
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Face circle
    const faceGrad = ctx.createLinearGradient(-faceRadius, -faceRadius, faceRadius, faceRadius);
    faceGrad.addColorStop(0, color);
    faceGrad.addColorStop(1, shiftColor(color, -40));
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.arc(0, 0, faceRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner shadow
    const innerShadow = ctx.createRadialGradient(0, -faceRadius * 0.3, 0, 0, 0, faceRadius);
    innerShadow.addColorStop(0, 'rgba(255,255,255,0.15)');
    innerShadow.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = innerShadow;
    ctx.beginPath();
    ctx.arc(0, 0, faceRadius, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeY = -faceRadius * 0.15;
    const eyeSpacing = faceRadius * 0.35;
    const eyeHeight = blinkRef.current.isBlinking ? 1 : faceRadius * 0.12;
    const eyeWidth = faceRadius * 0.12;

    ctx.fillStyle = 'white';
    // Left eye
    ctx.beginPath();
    ctx.ellipse(-eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(eyeSpacing, eyeY, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (track slightly)
    if (!blinkRef.current.isBlinking) {
      const pupilSize = eyeWidth * 0.55;
      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.arc(-eyeSpacing, eyeY + 1, pupilSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeSpacing, eyeY + 1, pupilSize, 0, Math.PI * 2);
      ctx.fill();

      // Pupil highlights
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-eyeSpacing - 2, eyeY - 2, pupilSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(eyeSpacing - 2, eyeY - 2, pupilSize * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyebrows
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const browY = eyeY - faceRadius * 0.18;
    const browLift = isSpeaking ? amplitude * 4 : 0;
    // Left brow
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing - eyeWidth, browY - browLift);
    ctx.quadraticCurveTo(-eyeSpacing, browY - 5 - browLift, -eyeSpacing + eyeWidth, browY - browLift);
    ctx.stroke();
    // Right brow
    ctx.beginPath();
    ctx.moveTo(eyeSpacing - eyeWidth, browY - browLift);
    ctx.quadraticCurveTo(eyeSpacing, browY - 5 - browLift, eyeSpacing + eyeWidth, browY - browLift);
    ctx.stroke();

    // Mouth
    const mouthY = faceRadius * 0.3;
    const mouthWidth = faceRadius * 0.35;
    const mouthOpen = isSpeaking ? amplitude * faceRadius * 0.25 : 0;

    ctx.fillStyle = shiftColor(color, -60);
    ctx.beginPath();
    if (mouthOpen > 2) {
      // Open mouth (ellipse)
      ctx.ellipse(0, mouthY, mouthWidth * (0.6 + amplitude * 0.4), mouthOpen, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tongue hint
      ctx.fillStyle = shiftColor(color, -30);
      ctx.beginPath();
      ctx.ellipse(0, mouthY + mouthOpen * 0.3, mouthWidth * 0.3, mouthOpen * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed mouth (smile)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-mouthWidth * 0.6, mouthY);
      ctx.quadraticCurveTo(0, mouthY + 8, mouthWidth * 0.6, mouthY);
      ctx.stroke();
    }

    // Initials on forehead
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = `bold ${faceRadius * 0.3}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    ctx.fillText(initials, 0, -faceRadius * 0.55);

    ctx.restore();

    frameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isSpeaking, color, name]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = 300;
      canvas.height = 300;
    }
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {role && <span className={styles.role}>{role}</span>}
        {isSpeaking && <span className={styles.speaking}>● Speaking</span>}
      </div>
    </div>
  );
}

// Utility: shift hex color brightness
function shiftColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
