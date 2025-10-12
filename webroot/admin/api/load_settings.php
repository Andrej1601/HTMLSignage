<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');
$fn = signage_data_path('settings.json');
if(!is_file($fn)){
echo json_encode([
  'version'=>1,
  'theme'=>[
    'bg'=>'#E8DEBD','fg'=>'#5C3101','accent'=>'#5C3101',
    'gridBorder'=>'#5C3101','gridTable'=>'#5C3101','gridTableW'=>2,
    'cellBg'=>'#5C3101','boxFg'=>'#FFFFFF',
    'headRowBg'=>'#E8DEBD','headRowFg'=>'#5C3101',
    'timeColBg'=>'#E8DEBD','timeZebra1'=>'#EAD9A0','timeZebra2'=>'#E2CE91',
    'zebra1'=>'#EDDFAF','zebra2'=>'#E6D6A1',
    'cornerBg'=>'#E8DEBD','cornerFg'=>'#5C3101',
    'tileBorder'=>'#5C3101','chipBorder'=>'#5C3101','chipBorderW'=>2,
    'flame'=>'#FFD166','saunaColor'=>'#5C3101'
  ],
  'fonts'=>[
    'family'=>"-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
    'scale'=>1, 'h1Scale'=>1, 'h2Scale'=>1,
    'overviewTitleScale'=>1, 'overviewHeadScale'=>0.9, 'overviewCellScale'=>0.8,
    'tileTextScale'=>0.8, 'tileWeight'=>600, 'chipHeight'=>1,
    'chipOverflowMode'=>'scale','flamePct'=>55,'flameGapScale'=>0.14
  ],
  'h2'=>['mode'=>'text','text'=>'Aufgusszeiten','showOnOverview'=>true],
  'display'=>['fit'=>'cover','rightWidthPercent'=>38,'cutTopPercent'=>28,'cutBottomPercent'=>12],
  'slides'=>[
    'overviewDurationSec'=>10,'saunaDurationSec'=>6,'transitionMs'=>500,
    'tileWidthPercent'=>45,'tileMinScale'=>0.25,'tileMaxScale'=>0.57,
    'tileFlameSizeScale'=>1,'tileFlameGapScale'=>1,
    'durationMode'=>'uniform','globalDwellSec'=>6,'loop'=>true,
    'order'=>['overview'],
    'saunaTitleMaxWidthPercent'=>64
  ],
  'assets'=>['rightImages'=>[], 'flameImage'=>'/assets/img/flame_test.svg'],
  'footnotes'=>[ ['id'=>'star','label'=>'*','text'=>'Nur am Fr und Sa'] ],
  'interstitials'=>[],
  'presets'=>[],
  'presetAuto'=>false
], SIGNAGE_JSON_FLAGS);
exit;
}
$raw = file_get_contents($fn);
if ($raw === false) {
  http_response_code(500);
  echo json_encode(['error'=>'read-failed']);
  exit;
}
echo $raw;
