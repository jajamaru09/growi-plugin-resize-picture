export interface ImageSpan {
  start: number; end: number;                 // `![…](…)` のオフセット（end は排他）
  commentStart?: number; commentEnd?: number; // 有効なコメントの範囲（間の空白は含まない）
  width?: number;                             // 1〜100
  src?: string;                               // 画像の原文（doc.slice(start, end)）。プレビューのずれ検出用
}

export const FILE_DATA_KEY = 'resizePicture'; // file.data[FILE_DATA_KEY]: Map<number, ImageSpan>（キーは start）
