# AI & Explainable AI (XAI) Methodology — HEATSHIELD AI

## 1. Machine Learning Pipeline Architecture
The machine learning pipeline is located under `/ai-engine`:
- `generate_dataset.py`: Synthesizes 5,000 environmental & contextual feature vectors.
- `train_model.py`: Benchmarks Decision Tree, Random Forest, Gradient Boosting, and Logistic Regression models.
- `models/evaluation_report.json`: Exports Macro F1 (80.8%), Accuracy (81.7%), and Confusion Matrix.

## 2. Explainable AI (XAI) Feature Attribution
Rather than providing a black-box score, HeatShield AI computes exact percentage contributions:
- **Temperature Load:** $\approx 42\%$ weight
- **Relative Humidity:** $\approx 28\%$ weight
- **Metabolic Activity:** $\approx 18\%$ weight
- **Exposure Duration:** $\approx 12\%$ weight

## 3. Dataset Notice
Synthetic training data is explicitly labeled:
`SYNTHETIC DEVELOPMENT DATA — NOT REAL-WORLD VALIDATION`
