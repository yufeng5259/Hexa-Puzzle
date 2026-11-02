// Semantic artwork regression: identities, text, local-to-page placement and style.
// Deliberately independent of wrapper names and serialized object indices.
export function authoredVisuals(objects, layout, imageUuids, stateRoots = []) {
    const imageIds = new Map((layout.dynamicSprites || []).map((reference, i) => [reference.__id__, layout.imageIds[i]]));
    const texts = new Map((layout.dynamicLabels || []).map((reference, i) => [reference.__id__, layout.previewTexts[i]]));
    const state = layout.node.__id__, root = objects[0].data.__id__, result = [];
    const otherStates = new Set(stateRoots.filter(id => id !== state));
    const walk = (id, x, y, scaleX, scaleY, opacity) => {
        const node = objects[id];
        if (otherStates.has(id) || (id !== state && node._active === false)) return;
        const components = node._components.map(reference => ({ ...objects[reference.__id__], index: reference.__id__ }));
        const ui = components.find(component => component.__type__ === 'cc.UITransform');
        const alpha = components.find(component => component.__type__ === 'cc.UIOpacity')?._opacity ?? 255;
        const sx = scaleX * node._lscale.x, sy = scaleY * node._lscale.y;
        const px = x + (id === root ? 0 : node._lpos.x * scaleX), py = y + (id === root ? 0 : node._lpos.y * scaleY);
        const box = [px, py, ui?._contentSize.width * sx, ui?._contentSize.height * sy, ui?._anchorPoint.x, ui?._anchorPoint.y];
        for (const component of components) {
            if (component._enabled === false) continue;
            if (component.__type__ === 'cc.Sprite') {
                const image = component._spriteFrame?.__uuid__ || imageUuids.get(imageIds.get(component.index));
                if (image) result.push({ kind: 'sprite', name: node._name, box, image, color: component._color, opacity: opacity * alpha / 255,
                    type: component._type, fill: [component._fillType, component._fillStart, component._fillRange], trimmed: component._isTrimmedMode });
            }
            if (component.__type__ === 'cc.Label') {
                const text = texts.has(component.index) ? String(texts.get(component.index)).replace(/\r\n?/g, '\n') : component._string;
                if (text) result.push({ kind: 'label', name: node._name, box, text, color: component._color, opacity: opacity * alpha / 255,
                    fontSize: component._fontSize, lineHeight: component._lineHeight, align: [component._horizontalAlign, component._verticalAlign],
                    wrap: component._enableWrapText, bold: component._isBold, outline: [component._enableOutline, component._outlineWidth, component._outlineColor] });
            }
        }
        for (const child of node._children) walk(child.__id__, px, py, sx, sy, opacity * alpha / 255);
    };
    // Normalize to the visual center of the Prefab, including organizational
    // ancestor transforms and shared content outside the selected state. List
    // roots intentionally use a top-left anchor, unlike ordinary centered views.
    const rootUi = objects[root]._components.map(reference => objects[reference.__id__]).find(component => component.__type__ === 'cc.UITransform');
    const x = (rootUi._anchorPoint.x - .5) * rootUi._contentSize.width;
    const y = (rootUi._anchorPoint.y - .5) * rootUi._contentSize.height;
    walk(root, x, y, 1, 1, 255);
    return result;
}
