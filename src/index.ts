import { LngLatLike, Marker } from "mapbox-gl";

export class SpiderLegParam {
  x!: number;
  y!: number;
  angle!: number;
  legLength!: number;
  index!: number;
}

export class SpiderLegElements {
  container!: HTMLDivElement;
  line!: HTMLDivElement;
  pin!: HTMLDivElement;
}

export class SpiderLeg {
  feature: any;
  elements!: SpiderLegElements;
  mapboxMarker!: Marker;
  param!: SpiderLegParam;
}

export class MapboxglSpiderifierOptions {
  animate?: boolean;
  animationSpeed?: number;
  customPin?: boolean;
  initializeLeg?: Function;
  onClick?: Function;
  circleSpiralSwitchover?: number;
  circleFootSeparation?: number;
  spiralFootSeparation?: number;
  spiralLengthStart?: number;
  spiralLengthFactor?: number;
}

export class MapboxglSpiderifier {
  private map: mapboxgl.Map;
  private NULL_FUNCTION: Function = () => {};
  private twoPi = Math.PI * 2;
  private previousSpiderLegs: SpiderLeg[] = [];
  private options = {
    animate: false,
    animationSpeed: 0,
    customPin: false,
    initializeLeg: this.NULL_FUNCTION,
    onClick: this.NULL_FUNCTION,
    circleSpiralSwitchover: 9,
    circleFootSeparation: 25,
    spiralFootSeparation: 28,
    spiralLengthStart: 15,
    spiralLengthFactor: 4,
  };

  constructor(map: mapboxgl.Map, userOptions?: MapboxglSpiderifierOptions) {
    this.options = {
      animate: userOptions?.animate || this.options.animate,
      animationSpeed:
        userOptions?.animationSpeed || this.options.animationSpeed,
      customPin: userOptions?.customPin || this.options.customPin,
      initializeLeg: userOptions?.initializeLeg || this.options.initializeLeg,
      onClick: userOptions?.onClick || this.options.onClick,
      circleSpiralSwitchover:
        userOptions?.circleSpiralSwitchover ||
        this.options.circleSpiralSwitchover,
      circleFootSeparation:
        userOptions?.circleFootSeparation || this.options.circleFootSeparation,
      spiralFootSeparation:
        userOptions?.spiralFootSeparation || this.options.spiralFootSeparation,
      spiralLengthStart:
        userOptions?.spiralLengthStart || this.options.spiralLengthStart,
      spiralLengthFactor:
        userOptions?.spiralLengthFactor || this.options.spiralLengthFactor,
    };
    this.map = map;
  }

  public spiderfy(latLng: LngLatLike, features: any[]) {
    const spiderLegParams = this.generateSpiderLegParams(features.length);

    this.unspiderfy();

    const spiderLegs: SpiderLeg[] = this.mapFn(
      features,
      (feature: any, index: number): SpiderLeg => {
        const spiderLegParam = spiderLegParams[index];
        const elements = this.createMarkerElements(spiderLegParam);

        const mapboxMarker = new Marker(elements.container).setLngLat(latLng);

        const spiderLeg: SpiderLeg = {
          feature: feature,
          elements: elements,
          mapboxMarker: mapboxMarker,
          param: spiderLegParam,
        };

        this.options.initializeLeg(spiderLeg);

        elements.container.onclick = (e) => this.options.onClick(e, spiderLeg);

        return spiderLeg;
      }
    );

    this.eachFn(spiderLegs.reverse(), (spiderLeg: SpiderLeg, index: number) => {
      spiderLeg.mapboxMarker.addTo(this.map);
    });

    if (this.options.animate) {
      setTimeout(() => {
        this.eachFn(
          spiderLegs.reverse(),
          (spiderLeg: SpiderLeg, index: number) => {
            spiderLeg.elements.container.className = (
              spiderLeg.elements.container.className || ""
            ).replace("initial", "");
            spiderLeg.elements.container.style.transitionDelay =
              (this.options.animationSpeed / 1000 / spiderLegs.length) * index +
              "s";
          }
        );
      });
    }

    this.previousSpiderLegs = spiderLegs;
  }

  public unspiderfy() {
    this.eachFn(
      this.previousSpiderLegs.reverse(),
      (spiderLeg: SpiderLeg, index: number) => {
        if (this.options.animate) {
          spiderLeg.elements.container.style.transitionDelay =
            (this.options.animationSpeed /
              1000 /
              this.previousSpiderLegs.length) *
              index +
            "s";
          spiderLeg.elements.container.className += " exit";
          setTimeout(() => {
            spiderLeg.mapboxMarker.remove();
          }, this.options.animationSpeed + 100); // Wait for 100ms more before clearing the DOM
        } else {
          spiderLeg.mapboxMarker.remove();
        }
      }
    );
    this.previousSpiderLegs = [];
  }

  public each(callback: Function) {
    this.eachFn(this.previousSpiderLegs, callback);
  }

  private createMarkerElements(
    spiderLegParam: SpiderLegParam
  ): SpiderLegElements {
    const containerElem = document.createElement("div"),
      pinElem = document.createElement("div"),
      lineElem = document.createElement("div");

    containerElem.className =
      "spider-leg-container" +
      (this.options.animate ? " animate initial " : " ");
    lineElem.className = "spider-leg-line";
    pinElem.className =
      "spider-leg-pin" + (this.options.customPin ? "" : " default-spider-pin");

    containerElem.appendChild(lineElem);
    containerElem.appendChild(pinElem);

    containerElem.style.marginLeft = spiderLegParam.x + "px";
    containerElem.style.marginTop = spiderLegParam.y + "px";

    lineElem.style.height = spiderLegParam.legLength + "px";
    // lineElem.style.transform = 'rotate(' + (2*Math.PI - spiderLegParam.angle) +'rad)';
    lineElem.style.transform =
      "rotate(" + (spiderLegParam.angle - Math.PI / 2) + "rad)";

    return { container: containerElem, line: lineElem, pin: pinElem };
  }

  private generateSpiderLegParams(count: number): SpiderLegParam[] {
    if (count >= this.options.circleSpiralSwitchover) {
      return this.generateSpiralParams(count);
    } else {
      return this.generateCircleParams(count);
    }
  }

  private generateCircleParams(count: number): SpiderLegParam[] {
    const circumference = this.options.circleFootSeparation * (2 + count);
    const legLength = circumference / this.twoPi; // = radius from circumference
    const angleStep = this.twoPi / count;

    return this.mapTimesFn(
      count,
      (index: number): SpiderLegParam => {
        const angle = index * angleStep;
        return {
          x: legLength * Math.cos(angle),
          y: legLength * Math.sin(angle),
          angle: angle,
          legLength: legLength,
          index: index,
        };
      }
    );
  }

  private generateSpiralParams(count: number): SpiderLegParam[] {
    let legLength = this.options.spiralLengthStart;
    let angle = 0;
    return this.mapTimesFn(
      count,
      (index: number): SpiderLegParam => {
        angle =
          angle +
          (this.options.spiralFootSeparation / legLength + index * 0.0005);
        const pt: SpiderLegParam = {
          x: legLength * Math.cos(angle),
          y: legLength * Math.sin(angle),
          angle: angle,
          legLength: legLength,
          index: index,
        };
        legLength =
          legLength + (this.twoPi * this.options.spiralLengthFactor) / angle;
        return pt;
      }
    );
  }

  private mapTimesFn(count: number, iterator: Function): any[] {
    const result: any[] = [];
    this.eachTimesFn(count, (i: number) => {
      result.push(iterator(i));
    });
    return result;
  }

  private eachTimesFn(count: number, iterator: Function) {
    if (!count) {
      return;
    }
    for (let i = 0; i < count; i++) {
      iterator(i);
    }
  }

  private mapFn(array: any[], iterator: Function): any[] {
    const result: any[] = [];
    this.eachFn(array, (item: any, i: number) => {
      result.push(iterator(item, i));
    });
    return result;
  }

  private eachFn(array: any[], iterator: Function) {
    if (!array || !array.length) {
      return;
    }
    for (let i = 0; i < array.length; i++) {
      iterator(array[i], i);
    }
  }
}
