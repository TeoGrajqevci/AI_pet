
// Build a permutation table for the noise function
export function buildPermutationTable() {
  const permutation = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0; i < permutation.length; i++) {
    const j = Math.floor(Math.random() * permutation.length);
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }
  // Extend the permutation to avoid overflow
  return [...permutation, ...permutation];
}

// Helper functions for noise generation
export function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function lerp(a, b, t) {
  return a + t * (b - a);
}

export function grad(hash, x, y) {
  // Convert low 4 bits of hash code into 12 gradient directions
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
}

// Simple 2D noise function (simplex/perlin-like)
export function noise(x, y, perm) {
  // Find unit grid cell containing the point
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  
  // Get relative coordinates inside the cell
  x -= Math.floor(x);
  y -= Math.floor(y);
  
  // Compute fade curves for each coordinate
  const u = fade(x);
  const v = fade(y);
  
  // Hash coordinates of the 4 corners
  const A = perm[X] + Y;
  const AA = perm[A];
  const AB = perm[A + 1];
  const B = perm[X + 1] + Y;
  const BA = perm[B];
  const BB = perm[B + 1];
  
  // Add blended results from the corners
  const result = lerp(
    lerp(grad(perm[AA], x, y), grad(perm[BA], x-1, y), u),
    lerp(grad(perm[AB], x, y-1), grad(perm[BB], x-1, y-1), u),
    v
  );
  
  // Return result in the range [-1, 1]
  return result;
}
