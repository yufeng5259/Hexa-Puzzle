export interface GuidePresentation {
    handWidth:number; handHeight:number;
    /** Normalized fingertip coordinates from the image bottom-left. */
    handTipX:number; handTipY:number;
    sourceHold:number; pressDuration:number; dragDuration:number; destinationHold:number;
    fadeDuration:number; loopDelay:number; pulseDuration:number;
    pulseMinOpacity:number; pulseMaxOpacity:number; instructionX:number; instructionY:number;
}
export const guidePresentationDefaults:Readonly<GuidePresentation> = Object.freeze({
    handWidth:140,handHeight:200,handTipX:.30,handTipY:.96,
    sourceHold:.25,pressDuration:.15,dragDuration:.9,destinationHold:.2,
    fadeDuration:.2,loopDelay:.25,pulseDuration:1.1,
    pulseMinOpacity:70,pulseMaxOpacity:190,instructionX:90,instructionY:-195,
});
export function guidePresentation(value:unknown,defaults:Partial<GuidePresentation>={}):GuidePresentation {
    const result={...guidePresentationDefaults,...defaults};
    const input=value&&typeof value==='object'?value as Record<string,unknown>:{};
    for(const key of Object.keys(result) as (keyof GuidePresentation)[])if(typeof input[key]==='number'&&Number.isFinite(input[key]))result[key]=input[key] as number;
    for(const key of ['handWidth','handHeight','dragDuration','pulseDuration'] as const)result[key]=Math.max(.01,result[key]);
    for(const key of ['sourceHold','pressDuration','destinationHold','fadeDuration','loopDelay'] as const)result[key]=Math.max(0,result[key]);
    result.handTipX=Math.max(0,Math.min(1,result.handTipX));result.handTipY=Math.max(0,Math.min(1,result.handTipY));
    result.pulseMinOpacity=Math.max(0,Math.min(255,result.pulseMinOpacity));result.pulseMaxOpacity=Math.max(result.pulseMinOpacity,Math.min(255,result.pulseMaxOpacity));
    return result;
}
