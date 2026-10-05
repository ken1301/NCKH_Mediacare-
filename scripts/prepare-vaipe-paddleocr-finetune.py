"""Prepare a Vietnamese character dictionary and PaddleOCR fine-tuning config."""

import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest-dir", default="dataset/processed/vaipe-ocr-crops/paddleocr")
    parser.add_argument("--paddleocr", default="runtime/PaddleOCR-src")
    parser.add_argument("--output", default="dataset/processed/vaipe-ocr-crops/paddleocr/fine-tune")
    args = parser.parse_args()

    manifest_dir = Path(args.manifest_dir).resolve()
    paddleocr_dir = Path(args.paddleocr).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    dictionary = set()
    sample_count = 0
    for split in ("train", "validation"):
        for line in (manifest_dir / f"rec_gt_{split}.txt").read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            _, text = line.split("\t", 1)
            dictionary.update(text)
            sample_count += 1
    dictionary.discard("\t")
    dictionary.discard("\r")
    dictionary.discard("\n")
    dict_path = output / "vaipe_vietnamese_dict.txt"
    dict_path.write_text("\n".join(sorted(dictionary)) + "\n", encoding="utf-8")

    config_path = output / "vaipe_ppocrv5_mobile_rec.yml"
    config_path.write_text(f"""Global:
  model_name: vaipe_ppocrv5_mobile_rec
  debug: false
  use_gpu: false
  epoch_num: 5
  log_smooth_window: 20
  print_batch_step: 20
  save_model_dir: {str((output / 'model').as_posix())}
  save_epoch_step: 1
  eval_batch_step: [0, 500]
  cal_metric_during_train: true
  pretrained_model: {str((output / 'PP-OCRv5_mobile_rec_pretrained.pdparams').as_posix())}
  checkpoints:
  use_visualdl: false
  character_dict_path: {str(dict_path.as_posix())}
  infer_mode: false
  use_space_char: true
  distributed: false
  d2s_train_image_shape: [3, 48, 320]

Optimizer:
  name: Adam
  beta1: 0.9
  beta2: 0.999
  lr:
    name: Cosine
    learning_rate: 0.00005
    warmup_epoch: 1
  regularizer:
    name: L2
    factor: 3.0e-05

Architecture:
  model_type: rec
  algorithm: SVTR_LCNet
  Transform:
  Backbone:
    name: PPLCNetV3
    scale: 0.95
  Head:
    name: MultiHead
    head_list:
      - CTCHead:
          Neck:
            name: svtr
            dims: 120
            depth: 2
            hidden_dims: 120
            kernel_size: [1, 3]
            use_guide: true
          Head:
            fc_decay: 0.00001
      - NRTRHead:
          nrtr_dim: 384
          max_text_length: 25

Loss:
  name: MultiLoss
  loss_config_list:
    - CTCLoss:
    - NRTRLoss:

PostProcess:
  name: CTCLabelDecode

Metric:
  name: RecMetric
  main_indicator: acc

Train:
  dataset:
    name: SimpleDataSet
    data_dir: {str(manifest_dir.parent.as_posix())}
    label_file_list:
      - {str((manifest_dir / 'rec_gt_train.txt').as_posix())}
    transforms:
      - DecodeImage:
          img_mode: BGR
          channel_first: false
      - CTCLabelEncode:
      - RecResizeImg:
          image_shape: [3, 48, 320]
      - KeepKeys:
          keep_keys: ['image', 'label', 'length', 'valid_ratio']
  loader:
    shuffle: true
    batch_size_per_card: 64
    drop_last: false
    num_workers: 2

Eval:
  dataset:
    name: SimpleDataSet
    data_dir: {str(manifest_dir.parent.as_posix())}
    label_file_list:
      - {str((manifest_dir / 'rec_gt_validation.txt').as_posix())}
    transforms:
      - DecodeImage:
          img_mode: BGR
          channel_first: false
      - CTCLabelEncode:
      - RecResizeImg:
          image_shape: [3, 48, 320]
      - KeepKeys:
          keep_keys: ['image', 'label', 'length', 'valid_ratio']
    loader:
      shuffle: false
      drop_last: false
      batch_size_per_card: 64
      num_workers: 2
""", encoding="utf-8")
    (output / "README.md").write_text(
        "# VAIPE OCR fine-tune\n\n"
        f"Dictionary characters: {len(dictionary)}\n"
        f"Training samples: {sample_count}\n\n"
        "The config is CPU-safe for a smoke run. For GPU training, set `use_gpu: true`.\n",
        encoding="utf-8",
    )
    print(json.dumps({"dictionary_size": len(dictionary), "samples": sample_count, "config": str(config_path)}))


if __name__ == "__main__":
    main()
