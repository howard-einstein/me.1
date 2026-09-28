(() => {
  const canvas = document.querySelector('.portrait-canvas');
  const image = document.querySelector('.portrait-source');
  const frame = document.querySelector('.portrait-frame');
  if (!canvas || !image || !frame) return;

  const context = canvas.getContext('2d');
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const pointer = { x: -1000, y: -1000, active: false };
  const particles = [];
  const ripples = [];
  const cellSize = 4;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  function buildField() {
    const bounds = frame.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const columns = Math.ceil(width / cellSize);
    const rows = Math.ceil(height / cellSize);
    sampleCanvas.width = columns;
    sampleCanvas.height = rows;
    sampleContext.fillStyle = '#fff';
    sampleContext.fillRect(0, 0, columns, rows);

    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    sampleContext.drawImage(image, (columns - drawWidth / cellSize) / 2, (rows - drawHeight / cellSize) / 2, drawWidth / cellSize, drawHeight / cellSize);

    const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
    const gray = new Float32Array(columns * rows);
    for (let index = 0; index < gray.length; index += 1) {
      const offset = index * 4;
      gray[index] = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
    }

    particles.length = 0;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const index = y * columns + x;
        const oldValue = Math.max(0, Math.min(1, gray[index]));
        const quantizedLevel = Math.round(oldValue * 3);
        const newValue = quantizedLevel / 3;
        const error = oldValue - newValue;
        gray[index] = newValue;
        particles.push({
          x: (x + 0.5) * cellSize,
          y: (y + 0.5) * cellSize,
          homeX: (x + 0.5) * cellSize,
          homeY: (y + 0.5) * cellSize,
          vx: 0,
          vy: 0,
          size: 0.55 + newValue * 1.4,
          alpha: 0.25 + newValue * 0.7,
        });
        if (x + 1 < columns) gray[index + 1] += error * 7 / 16;
        if (y + 1 < rows) {
          if (x > 0) gray[index + columns - 1] += error * 3 / 16;
          gray[index + columns] += error * 5 / 16;
          if (x + 1 < columns) gray[index + columns + 1] += error / 16;
        }
      }
    }
  }

  function movePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
  }

  function animate() {
    context.clearRect(0, 0, width, height);
    for (let index = ripples.length - 1; index >= 0; index -= 1) {
      const ripple = ripples[index];
      ripple.radius += 3.2;
      ripple.life -= 0.018;
      if (ripple.life <= 0) {
        ripples.splice(index, 1);
        continue;
      }
      context.beginPath();
      context.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(0, 229, 255, ${ripple.life * 0.48})`;
      context.lineWidth = 1;
      context.stroke();
    }

    for (const particle of particles) {
      const homeForce = 0.035;
      particle.vx += (particle.homeX - particle.x) * homeForce;
      particle.vy += (particle.homeY - particle.y) * homeForce;

      if (pointer.active) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const reach = 72;
        if (distance < reach) {
          const force = (1 - distance / reach) * 1.65;
          particle.vx += dx / distance * force;
          particle.vy += dy / distance * force;
        }
      }

      for (const ripple of ripples) {
        const dx = particle.x - ripple.x;
        const dy = particle.y - ripple.y;
        const distance = Math.hypot(dx, dy) || 0.001;
        const difference = Math.abs(distance - ripple.radius);
        if (difference < 15) {
          const force = (1 - difference / 15) * ripple.life * 0.65;
          particle.vx += dx / distance * force;
          particle.vy += dy / distance * force;
        }
      }

      particle.vx *= 0.84;
      particle.vy *= 0.84;
      particle.x += particle.vx;
      particle.y += particle.vy;
      context.fillStyle = `rgba(0, 229, 255, ${particle.alpha})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    requestAnimationFrame(animate);
  }

  image.addEventListener('load', buildField, { once: true });
  if (image.complete && image.naturalWidth) buildField();
  canvas.addEventListener('pointermove', movePointer);
  canvas.addEventListener('pointerleave', () => { pointer.active = false; });
  canvas.addEventListener('pointerdown', (event) => {
    movePointer(event);
    ripples.push({ x: pointer.x, y: pointer.y, radius: 0, life: 1 });
    if (ripples.length > 4) ripples.shift();
  });
  window.addEventListener('resize', buildField);
  if (image.complete && image.naturalWidth) requestAnimationFrame(animate);
  else image.addEventListener('load', () => requestAnimationFrame(animate), { once: true });
})();