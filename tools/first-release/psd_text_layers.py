"""Create actual editable Microsoft YaHei PSD TypeLayers with raster caches.

Uses the documented TySh descriptor and EngineData structures, cross-checked
against psd-tools' official layers-minimal/type-layer.psd fixture. No Photoshop
installation, remote service or downloaded template is required at runtime.
Raster channels are a display cache; the Unicode text, font, size, fill,
outline and paragraph alignment remain in genuine Photoshop type metadata.
"""

from __future__ import annotations

import copy
import io
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer, TypeLayer
from psd_tools.constants import Compression, Tag
from psd_tools.psd import engine_data as ed
from psd_tools.psd.descriptor import (
    Descriptor, DescriptorBlock, Double, Enumerated, Integer, RawData,
    String, UnitFloat,
)
from psd_tools.psd.tagged_blocks import TaggedBlock, TypeToolObjectSetting


FONT_ROOT = Path('C:/Windows/Fonts')
FONT_CHOICES = {
    'regular': ('msyh.ttc', 'MicrosoftYaHei'),
    'bold': ('msyhbd.ttc', 'MicrosoftYaHei-Bold'),
    'light': ('msyhl.ttc', 'MicrosoftYaHeiLight'),
}


def _engine(value: Any) -> Any:
    if isinstance(value, dict):
        result = ed.Dict()
        for key, item in value.items():
            result[key] = _engine(item)
        return result
    if isinstance(value, list):
        return ed.List([_engine(item) for item in value])
    if isinstance(value, bool):
        return ed.Bool(value)
    if isinstance(value, int):
        return ed.Integer(value)
    if isinstance(value, float):
        return ed.Float(value)
    if isinstance(value, str):
        return ed.String(value)
    raise TypeError(type(value).__name__)


def normalize_text_spec(spec: dict[str, Any]) -> dict[str, Any]:
    result = copy.deepcopy(spec)
    for key in ('layer_name', 'text', 'position', 'box', 'font_size', 'color_rgb', 'align'):
        if key not in result:
            raise ValueError(f'Text spec requires {key}')
    if not isinstance(result['text'], str) or not result['text']:
        raise ValueError('Text must be nonempty Unicode')
    result['text'] = result['text'].replace('\r\n', '\r').replace('\n', '\r')
    if '\x00' in result['text']:
        raise ValueError('Text may not contain NUL')
    for key, length in [('position', 2), ('box', 4), ('color_rgb', 3)]:
        if len(result[key]) != length:
            raise ValueError(f'Invalid {key}: {result[key]}')
    if result['box'][2] <= result['box'][0] or result['box'][3] <= result['box'][1]:
        raise ValueError('Text box must have positive dimensions')
    if float(result['font_size']) <= 0:
        raise ValueError('font_size must be positive image pixels')
    if 'min_font_size' in result:
        minimum = float(result['min_font_size'])
        if not 0 < minimum <= float(result['font_size']) + .25:
            raise ValueError('min_font_size must be positive and no larger than the display size')
    if 'max_lines' in result and (not isinstance(result['max_lines'], int) or result['max_lines'] < 1):
        raise ValueError('max_lines must be a positive integer')
    if result['align'] not in ('left', 'center', 'right'):
        raise ValueError('align must be left, center or right')
    weight = str(result.get('weight', result.get('font_weight', 'regular'))).lower()
    weight = {'normal': 'regular', '400': 'regular', '700': 'bold', '600': 'bold', '300': 'light'}.get(weight, weight)
    if weight not in FONT_CHOICES:
        raise ValueError(f'Unsupported Microsoft YaHei weight: {weight}')
    result['weight'] = weight
    result['font_file'], result['postscript_font'] = FONT_CHOICES[weight]
    if not (FONT_ROOT / result['font_file']).is_file():
        raise FileNotFoundError(FONT_ROOT / result['font_file'])
    result['stroke_width'] = float(result.get('stroke_width', 0))
    result['stroke_color'] = list(result.get('stroke_color', [0, 0, 0]))
    if result['stroke_width'] < 0 or len(result['stroke_color']) != 3:
        raise ValueError('Invalid text stroke')
    for color in (result['color_rgb'], result['stroke_color']):
        if any(not 0 <= channel <= 255 for channel in color):
            raise ValueError('RGB color channels must be in [0,255]')
    return result


def render_text_cache(spec: dict[str, Any], scale: int = 4) -> dict[str, Any]:
    """Render only YaHei text on transparent pixels; return exact cache origin.

    position is the intended upper-left ink position, including the outline.
    box limits the available dimensions. Fitting reduces font size only when
    needed, and records the actual fitted size in the returned spec.
    """
    actual = normalize_text_spec(spec)
    text = actual['text'].replace('\r', '\n')
    width = actual['box'][2] - actual['box'][0]
    height = actual['box'][3] - actual['box'][1]
    font_size = float(actual['font_size'])
    requested_size = font_size
    minimum_size = math.ceil(float(actual.get('min_font_size', 4)) * scale) / scale
    stroke = int(round(actual['stroke_width'] * scale))
    measurement = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    while True:
        font = ImageFont.truetype(str(FONT_ROOT / actual['font_file']), max(1, round(font_size * scale)))
        spacing = max(0, int(round(font_size * .18 * scale)))
        bbox = measurement.multiline_textbbox((0, 0), text, font=font,
                                               stroke_width=stroke, spacing=spacing,
                                               align=actual['align'])
        natural_width, natural_height = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if (not actual.get('fit', True) or (natural_width <= width * scale and natural_height <= height * scale)
                or font_size <= minimum_size):
            break
        ratio = min(width * scale / max(1, natural_width), height * scale / max(1, natural_height))
        font_size = max(minimum_size, min(font_size - .25, font_size * ratio))
    actual['requested_font_size'] = requested_size
    actual['font_size'] = round(font.size / scale, 4)
    actual['layout_overflow'] = bool(natural_width > width * scale or natural_height > height * scale
                                   or ('max_lines' in actual and len(text.split('\n')) > actual['max_lines']))
    actual['measured_ink_size'] = [math.ceil(natural_width / scale), math.ceil(natural_height / scale)]
    padding = 2 * scale
    canvas = Image.new('RGBA', (max(1, int(math.ceil(natural_width)) + 2 * padding),
                              max(1, int(math.ceil(natural_height)) + 2 * padding)))
    draw = ImageDraw.Draw(canvas)
    draw.multiline_text((padding - bbox[0], padding - bbox[1]), text, font=font,
                        fill=tuple(actual['color_rgb']) + (255,), align=actual['align'],
                        spacing=spacing, stroke_width=stroke,
                        stroke_fill=tuple(actual['stroke_color']) + (255,))
    canvas = canvas.resize((int(math.ceil(canvas.width / scale)),
                            int(math.ceil(canvas.height / scale))), Image.Resampling.LANCZOS)
    left, top = actual['position']
    offset = (int(round(left)) - 2, int(round(top)) - 2)
    ascent, _ = font.getmetrics()
    advance = max(measurement.textlength(line or ' ', font=font) for line in text.split('\n')) / scale
    shift = {'left': 0.0, 'center': advance / 2, 'right': advance}[actual['align']]
    transform = (1., 0., 0., 1., left - bbox[0] / scale + shift,
                 top - bbox[1] / scale + ascent / scale)
    return {'image': canvas, 'offset': offset, 'transform': transform,
            'spec': actual, 'advance': advance, 'baseline_offset': ascent / scale}


def build_type_tool(spec: dict[str, Any], cache: dict[str, Any]) -> TypeToolObjectSetting:
    actual = cache['spec']
    text = actual['text']
    # Engine runs count UTF-16 code units and include Photoshop's terminal CR.
    engine_text = text + '\r'
    run_length = len(engine_text.encode('utf-16-be')) // 2
    align = {'left': 0, 'right': 1, 'center': 2}[actual['align']]
    fill = [1.0] + [float(value) / 255 for value in actual['color_rgb']]
    outline = [1.0] + [float(value) / 255 for value in actual['stroke_color']]
    style = {
        'Font': 0, 'FontSize': float(actual['font_size']),
        'FauxBold': False, 'FauxItalic': False, 'AutoLeading': True,
        'Leading': 0.0, 'HorizontalScale': 1.0, 'VerticalScale': 1.0,
        'Tracking': 0, 'AutoKerning': True, 'Kerning': 0, 'BaselineShift': 0.0,
        'FontCaps': 0, 'FontBaseline': 0, 'Underline': False, 'Strikethrough': False,
        'Ligatures': True, 'DLigatures': False, 'BaselineDirection': 2,
        'Tsume': 0.0, 'StyleRunAlignment': 2, 'Language': 2, 'NoBreak': False,
        'FillColor': {'Type': 1, 'Values': fill},
        'StrokeColor': {'Type': 1, 'Values': outline},
        'FillFlag': True, 'StrokeFlag': actual['stroke_width'] > 0,
        'FillFirst': False, 'OutlineWidth': float(actual['stroke_width']),
        'CharacterDirection': 0, 'HindiNumbers': False,
    }
    paragraph = {
        'Justification': align, 'FirstLineIndent': 0.0, 'StartIndent': 0.0,
        'EndIndent': 0.0, 'SpaceBefore': 0.0, 'SpaceAfter': 0.0,
        'AutoHyphenate': False, 'WordSpacing': [.8, 1.0, 1.33],
        'LetterSpacing': [0.0, 0.0, 0.0], 'GlyphSpacing': [1.0, 1.0, 1.0],
        'AutoLeading': 1.2, 'LeadingType': 0, 'Hanging': False,
        'Burasagari': False, 'KinsokuOrder': 0, 'EveryLineComposer': False,
    }
    paragraph_run = {
        'ParagraphSheet': {'DefaultStyleSheet': 0, 'Properties': paragraph},
        'Adjustments': {'Axis': [1.0, 0.0, 1.0], 'XY': [0.0, 0.0]},
    }
    style_run = {'StyleSheet': {'StyleSheetData': style}}
    resource = {
        'KinsokuSet': [], 'MojiKumiSet': [], 'TheNormalStyleSheet': 0,
        'TheNormalParagraphSheet': 0,
        'ParagraphSheetSet': [{'Name': 'Normal RGB', 'DefaultStyleSheet': 0, 'Properties': paragraph}],
        'StyleSheetSet': [{'Name': 'Normal RGB', 'StyleSheetData': style}],
        'FontSet': [{'Name': actual['postscript_font'], 'Script': 25, 'FontType': 1, 'Synthetic': 0}],
        'SuperscriptSize': .583, 'SuperscriptPosition': .333,
        'SubscriptSize': .583, 'SubscriptPosition': .333, 'SmallCapSize': .7,
    }
    engine_payload = {
        'EngineDict': {
            'Editor': {'Text': engine_text},
            'ParagraphRun': {'DefaultRunData': paragraph_run, 'RunArray': [paragraph_run],
                             'RunLengthArray': [run_length], 'IsJoinable': 1},
            'StyleRun': {'DefaultRunData': style_run, 'RunArray': [style_run],
                         'RunLengthArray': [run_length], 'IsJoinable': 2},
            'GridInfo': {'GridIsOn': False, 'ShowGrid': False},
            'AntiAlias': 4, 'UseFractionalGlyphWidths': True,
            'Rendered': {'Version': 1, 'Shapes': {'WritingDirection': 0, 'Children': [{
                'ShapeType': 0, 'Procession': 0,
                'Lines': {'WritingDirection': 0, 'Children': []},
                'Cookie': {'Photoshop': {'ShapeType': 0, 'PointBase': [0.0, 0.0],
                                        'Base': {'ShapeType': 0, 'TransformPoint0': [1.0, 0.0],
                                                 'TransformPoint1': [0.0, 1.0], 'TransformPoint2': [0.0, 0.0]}}},
            }]}},
        },
        'ResourceDict': resource, 'DocumentResources': copy.deepcopy(resource),
    }
    engine = ed.EngineData()
    for key, value in engine_payload.items():
        engine[key] = _engine(value)
    bounds = Descriptor(classID=b'Rct1')
    tx, ty = cache['transform'][4:]
    x, y = cache['offset']
    for key, value in zip((b'Left', b'Top ', b'Rght', b'Btom'),
                           (x - tx, y - ty, x + cache['image'].width - tx, y + cache['image'].height - ty)):
        bounds[key] = UnitFloat(float(value), unit=b'#Pxl')
    data = DescriptorBlock(classID=b'TxLr')
    data[b'Txt '] = String(text + '\x00')
    data[b'textGridding'] = Enumerated(b'textGridding', b'None')
    data[b'Ornt'] = Enumerated(b'Ornt', b'Hrzn')
    data[b'AntA'] = Enumerated(b'Annt', b'AnSm')
    data[b'bounds'] = copy.deepcopy(bounds)
    data[b'boundingBox'] = copy.deepcopy(bounds)
    data[b'TextIndex'] = Integer(0)
    data[b'EngineData'] = RawData(engine)
    warp = DescriptorBlock(classID=b'warp')
    warp[b'warpStyle'] = Enumerated(b'warpStyle', b'warpNone')
    warp[b'warpValue'] = Double(0.)
    warp[b'warpPerspective'] = Double(0.)
    warp[b'warpPerspectiveOther'] = Double(0.)
    warp[b'warpRotate'] = Enumerated(b'Ornt', b'Hrzn')
    return TypeToolObjectSetting(
        version=1, transform=cache['transform'], text_version=50,
        text_data=data, warp_version=1, warp=warp,
        left=0, top=0, right=cache['image'].width, bottom=cache['image'].height,
    )


def create_type_layer(parent: Any, spec: dict[str, Any], index: int | None = None,
                      cache: dict[str, Any] | None = None) -> tuple[TypeLayer, dict[str, Any]]:
    cache = cache or render_text_cache(spec)
    actual = cache['spec']
    document = parent._psd
    if document.depth != 8 or document.pil_mode != 'RGBA':
        raise ValueError('Text creation requires an 8-bit RGBA PSD')
    record, channels = PixelLayer._build_layer_record_and_channels(
        cache['image'], actual['layer_name'], *cache['offset'], Compression.RLE,
        version=document._record.header.version, depth=document.depth,
    )
    record.tagged_blocks[Tag.TYPE_TOOL_OBJECT_SETTING] = TaggedBlock(
        key=Tag.TYPE_TOOL_OBJECT_SETTING, data=build_type_tool(actual, cache),
    )
    layer = TypeLayer(parent, record, channels)
    # The public name setter supplies Photoshop's safe legacy name plus luni.
    layer.name = actual['layer_name']
    layer.visible = bool(actual.get('visible', True))
    parent.insert(len(parent) if index is None else index, layer)
    verify_type_layer(layer, actual)
    return layer, cache


def verify_type_layer(layer: Any, spec: dict[str, Any]) -> dict[str, Any]:
    actual = normalize_text_spec(spec)
    if not isinstance(layer, TypeLayer) or layer.kind != 'type':
        raise AssertionError(f'Not a genuine editable TypeLayer: {layer.name}')
    if layer.text != actual['text']:
        raise AssertionError(f'TypeLayer Unicode text mismatch: {layer.name}')
    names = layer.font_names
    if names != [actual['postscript_font']]:
        raise AssertionError(f'TypeLayer is not declared in Microsoft YaHei: {names}')
    engine_text = layer.engine_dict['Editor']['Text'].value
    if engine_text != actual['text'] + '\r':
        raise AssertionError('EngineData text differs from descriptor text')
    expected_units = len(engine_text.encode('utf-16-be')) // 2
    for run_name in ('StyleRun', 'ParagraphRun'):
        run = layer.engine_dict[run_name]
        lengths = [int(value.value) for value in run['RunLengthArray']]
        if sum(lengths) != expected_units or len(lengths) != len(run['RunArray']):
            raise AssertionError(f'{run_name} lengths do not cover the editable UTF-16 text')
    style = layer.engine_dict['StyleRun']['RunArray'][0]['StyleSheet']['StyleSheetData']
    for run in layer.engine_dict['StyleRun']['RunArray']:
        editable=run['StyleSheet']['StyleSheetData']
        for key,expected in [('FontSize',float(actual['font_size'])),
                             ('OutlineWidth',actual['stroke_width']),
                             ('HorizontalScale',1.),('VerticalScale',1.),('Font',0)]:
            if abs(float(editable[key].value)-expected)>.001:
                raise AssertionError(f'Editable {key} differs from declared text style: {layer.name}')
        for key,color in [('FillColor',actual['color_rgb']),('StrokeColor',actual['stroke_color'])]:
            expected=[1.]+[float(v)/255 for v in color]
            values=[float(v.value) for v in editable[key]['Values']]
            if len(values)!=4 or any(abs(a-b)>1e-6 for a,b in zip(values,expected)):
                raise AssertionError(f'Editable {key} differs from rendered cache: {layer.name}')
        if not editable['FillFlag'].value or bool(editable['StrokeFlag'].value)!=(actual['stroke_width']>0):
            raise AssertionError('Editable text fill/stroke enablement mismatch')
    for run in layer.engine_dict['ParagraphRun']['RunArray']:
        justification=run['ParagraphSheet']['Properties']['Justification'].value
        if justification!={'left':0,'right':1,'center':2}[actual['align']]:
            raise AssertionError('Editable paragraph alignment mismatch')
    expected_cache=render_text_cache(actual)
    transform=expected_cache['transform']
    angle=float(actual.get('rotation_degrees',0))
    if angle:
        x,y=expected_cache['offset'];im=expected_cache['image'];cx=x+im.width/2;cy=y+im.height/2
        a,b,c,d,tx,ty=transform;co=math.cos(math.radians(angle));si=math.sin(math.radians(angle))
        transform=(co*a+si*b,-si*a+co*b,co*c+si*d,-si*c+co*d,
                   cx+co*(tx-cx)+si*(ty-cy),cy-si*(tx-cx)+co*(ty-cy))
    if any(abs(a-b)>1e-5 for a,b in zip(layer.transform,transform)):
        raise AssertionError('Editable type transform differs from declared position/rotation')
    return {'name': layer.name, 'kind': layer.kind, 'text': layer.text,
            'font_names': names, 'font_size': float(style['FontSize'].value),
            'stroke_width': float(style['OutlineWidth'].value),
            'utf16_run_units': expected_units,
            'style_and_paragraph_run_lengths_verified': True,
            'editable_fill_stroke_alignment_transform_verified': True,
            'editable_text_descriptor_present': Tag.TYPE_TOOL_OBJECT_SETTING in layer.tagged_blocks}


def roundtrip_probe() -> dict[str, Any]:
    """In-memory validation; never writes a delivery PSD or any disk file."""
    document = PSDImage.new('RGBA', (512, 160), color=(0, 0, 0, 0))
    document.background_color = None
    spec = {'layer_name': '动态价格_真实文本', 'text': '¥1,280 倒计时 00:59',
            'position': [20, 30], 'box': [20, 30, 490, 110], 'font_size': 34,
            'color_rgb': [255, 240, 100], 'align': 'left', 'weight': 'bold',
            'stroke_color': [70, 30, 10], 'stroke_width': 1.5}
    _, cache = create_type_layer(document, spec)
    stream = io.BytesIO()
    document.save(stream)
    reopened = PSDImage.open(io.BytesIO(stream.getvalue()))
    result = verify_type_layer(reopened[0], cache['spec'])
    if reopened[0].topil().tobytes() != cache['image'].tobytes():
        raise AssertionError('TypeLayer display-cache pixels failed round-trip')
    result['cache_rgba_exact_after_roundtrip'] = True
    result['psd_bytes'] = len(stream.getvalue())
    return result


if __name__ == '__main__':
    import json
    print(json.dumps(roundtrip_probe(), ensure_ascii=False, indent=2))
