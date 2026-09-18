import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const MODELS_DIR = join(process.cwd(), "models");

function loadJSON(filename: string): any {
  const content = readFileSync(join(MODELS_DIR, filename), "utf-8");
  return JSON.parse(content) as any;
}

function matrixKey(matrix: any): string {
  return JSON.stringify(matrix);
}

describe("ML Evaluation Report Validation", () => {
  const report = loadJSON("evaluation_report.json") as any;

  it("has required top-level schema fields", () => {
    assert.ok(report.best_model, "Missing best_model");
    assert.ok(report.model_version, "Missing model_version");
    assert.ok(report.dataset_notice, "Missing dataset_notice");
    assert.ok(report.metrics, "Missing primary metrics");
    assert.ok(report.all_models_benchmark, "Missing all_models_benchmark");
    assert.ok(report.feature_importances, "Missing feature_importances");
  });

  it("dataset_notice contains SYNTHETIC marker (honest scientific framing)", () => {
    assert.ok(
      report.dataset_notice.includes("SYNTHETIC"),
      "dataset_notice must declare SYNTHETIC data"
    );
  });

  it("primary metric values are within valid range [0, 1]", () => {
    const m = report.metrics;
    assert.ok(m.accuracy >= 0 && m.accuracy <= 1, "accuracy out of [0,1]");
    assert.ok(m.precision >= 0 && m.precision <= 1, "precision out of [0,1]");
    assert.ok(m.recall >= 0 && m.recall <= 1, "recall out of [0,1]");
    assert.ok(m.macro_f1 >= 0 && m.macro_f1 <= 1, "macro_f1 out of [0,1]");
    assert.ok(m.roc_auc >= 0 && m.roc_auc <= 1, "roc_auc out of [0,1]");
  });

  it("all 4 models present in benchmark", () => {
    const expected = ["Logistic Regression", "Decision Tree", "Random Forest", "Gradient Boosting"];
    for (const model of expected) {
      assert.ok(model in report.all_models_benchmark, "Expected model: " + model);
    }
  });

  it("confusion matrices are distinct across all models (no fabricated duplicates)", () => {
    const matrices = Object.entries(report.all_models_benchmark).map(
      ([name, data]) => ({ name, key: matrixKey(data.confusion_matrix) })
    );
    const uniqueKeys = new Set(matrices.map((m) => m.key));
    assert.strictEqual(
      uniqueKeys.size,
      matrices.length,
      "Expected " + matrices.length + " distinct confusion matrices, got " + uniqueKeys.size + ". Indicates fabricated outputs."
    );
  });

  it("model metrics are not arithmetically offset copies of each other", () => {
    const models = Object.values(report.all_models_benchmark);
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const sameAccuracy = Math.abs(models[i].accuracy - models[j].accuracy) < 0.001;
        const samePrecision = Math.abs(models[i].precision - models[j].precision) < 0.001;
        const sameRecall = Math.abs(models[i].recall - models[j].recall) < 0.001;
        assert.ok(!(sameAccuracy && samePrecision && sameRecall),
          "Models " + i + " and " + j + " have suspiciously identical metrics — possible fabrication.");
      }
    }
  });

  it("per-class metrics cover all 4 risk classes", () => {
    const expectedClasses = ["LOW", "MODERATE", "HIGH", "EXTREME"];
    for (const cls of expectedClasses) {
      assert.ok(cls in report.metrics.per_class_metrics, "Missing per-class metrics for: " + cls);
    }
  });

  it("feature importances sum to approximately 1.0", () => {
    const total = Object.values(report.feature_importances).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(total - 1.0) < 0.01, "Feature importances should sum to ~1.0, got " + total.toFixed(4));
  });

  it("train + test samples equal total sample_count", () => {
    assert.strictEqual(
      report.train_samples + report.test_samples,
      report.sample_count,
      "train + test !== sample_count"
    );
  });
});

describe("ML Model Metadata Validation", () => {
  const meta = loadJSON("model_metadata.json");

  it("model_metadata.json has required schema fields", () => {
    assert.ok((meta as any).model_version, "Missing model_version");
    assert.ok(meta.algorithm, "Missing algorithm");
    assert.ok(meta.trained_at, "Missing trained_at");
    assert.ok(meta.limitation_disclosure, "Missing limitation_disclosure");
  });

  it("limitation_disclosure is non-empty and honest", () => {
    assert.ok((meta as any).limitation_disclosure && (meta as any).limitation_disclosure.length > 20, "limitation_disclosure must be substantive (> 20 chars)");
  });
});
