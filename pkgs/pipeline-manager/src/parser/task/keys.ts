export const nodeKeys = [
  'next',
  'rate_limit',
  'timeout',
  'on_error',
  'anchor',
  'inverse',
  'enabled',
  'max_hit',
  'pre_delay',
  'post_delay',
  'pre_wait_freezes',
  'post_wait_freezes',
  'repeat',
  'repeat_delay',
  'repeat_wait_freezes',
  'focus',
  'attach',
  'doc',
  'desc'
]

export const recoKeys = [
  'roi',
  'roi_offset',
  'template',
  'threshold',
  'order_by',
  'index',
  'method',
  'green_mask',
  'count',
  'detector',
  'ratio',
  'lower',
  'upper',
  'connected',
  'expected',
  'threshold',
  'replace',
  'only_rec',
  'model',
  'labels',
  'all_of',
  'box_index',
  'sub_name',
  'any_of',
  'custom_recognition',
  'custom_recognition_param'
]

export const actKeys = [
  'target',
  'target_offset',
  'contact',
  'pressure',
  'duration',
  'begin',
  'begin_offset',
  'end',
  'end_offset',
  'end_hold',
  'only_hover',
  'swipes',
  'dx',
  'dy',
  'key',
  'input_text',
  'package',
  'exec',
  'args',
  'detach',
  'cmd',
  'custom_action',
  'custom_action_param'
]

export const maaNodeKeys = [
  'baseTask',
  // 'algorithm',
  // 'action',
  'sub',
  'subErrorIgnored',
  'next',
  'maxTimes',
  'exceededNext',
  'onErrorNext',
  'preDelay',
  'postDelay',
  'roi',
  'cache',
  'rectMove',
  'reduceOtherTimes',
  'specificRect',
  'specialParams',
  'highResolutionSwipeFix'
]

export const maaRecoKeys = [
  // MatchTemplate
  'template',
  'templThreshold',
  'maskRange',
  'colorScales',
  'colorWithClose',
  'pureColor',
  'method',

  // OcrDetect
  'text',
  'ocrReplace',
  'fullMatch',
  'isAscii',
  'withoutDet',
  'useRaw',
  'binThreshold',

  // FeatureMatch
  // 'template',
  'count',
  'ratio',
  'detector'
]

export const maaActKeys = [
  // Input
  'inputText'
]
