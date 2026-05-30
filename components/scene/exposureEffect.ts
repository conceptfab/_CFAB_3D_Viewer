import { Effect } from 'postprocessing';
import { Uniform } from 'three';

const fragmentShader = /* glsl */ `
uniform float exposure;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
`;

/**
 * Skaluje radiancję sceny PRZED krzywą tone mappingu. Pipeline renderuje scenę z
 * THREE.NoToneMapping, a postprocessing ToneMappingEffect nie ma uniformu ekspozycji
 * ani nie czyta renderer.toneMappingExposure — dlatego ekspozycję wstrzykujemy tym
 * efektem ustawionym w łańcuchu PRZED <ToneMapping/>.
 */
export class ExposureEffect extends Effect {
  constructor(exposure = 1) {
    super('ExposureEffect', fragmentShader, {
      uniforms: new Map([['exposure', new Uniform(exposure)]]),
    });
  }

  set exposure(value: number) {
    (this.uniforms.get('exposure') as Uniform).value = value;
  }

  get exposure(): number {
    return (this.uniforms.get('exposure') as Uniform).value;
  }
}
