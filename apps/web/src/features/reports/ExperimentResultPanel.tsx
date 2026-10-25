import {
  URL_BASELINE_PROFILE,
  activationLabel,
  deviceLabel,
  displayText,
  formatGrouped,
  formatRate,
  formatRatio,
  frameworkLabel,
  isUrlFfn,
  matchingVersion,
  NOT_RECORDED,
  optimizerLabel,
  outputLabel,
  publicText,
  readEvaluation,
  readFeature,
  readModel,
  representationLabel,
  splitTotal,
  vocabularyFitLabel,
} from "@/features/reports/experimentResult";
import { formatTimestamp } from "@/lib/format";
import type { DatasetDetail, ExperimentDetail } from "@/services/api-types";

const HISTORICAL = {
  accuracy: "79%",
  phishing: "64/100",
  falsePositives: "6/100",
};

export function ExperimentResultPanel({
  detail,
  dataset,
  datasetPending,
}: {
  detail: ExperimentDetail;
  dataset: DatasetDetail | undefined;
  datasetPending: boolean;
}) {
  const evaluation = readEvaluation(detail);
  const feature = readFeature(detail.feature_config);
  const model = readModel(detail.model_settings);
  const version = matchingVersion(dataset, detail.dataset_version_label);
  const urlBaseline = version?.derivation_profile === URL_BASELINE_PROFILE || isUrlFfn(detail);
  const trainCounts = version?.split_label_counts?.train;
  const testCounts = version?.split_label_counts?.test;
  const trainTotal = splitTotal(trainCounts);
  const testTotal = splitTotal(testCounts);
  const title = isUrlFfn(detail) ? "PhreshPhish URL FFN v1" : publicText(detail.name);

  return (
    <div className="space-y-8 text-sm" data-testid="experiment-detail">
      <section aria-labelledby="experiment-overview-heading">
        <h3 id="experiment-overview-heading" className="font-heading text-base text-[var(--text)]">
          Overview
        </h3>
        <p className="mt-2 text-[var(--text)]">{title}</p>
        <p className="mt-1 text-[var(--muted)]">
          {detail.id} · Status {statusWord(detail.status)}
        </p>
        {isUrlFfn(detail) ? (
          <p className="mt-3 max-w-3xl leading-relaxed text-[var(--text)]">
            Reproducible URL-based phishing classification experiment using a pinned
            PhreshPhish-derived dataset.
          </p>
        ) : null}
        <p className="mt-3 leading-relaxed text-[var(--text)]">{displayText(detail.notes)}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Fact label="Profile" value={displayText(detail.experiment_profile)} />
          <Fact label="Approach" value={displayText(detail.approach)} />
          <Fact
            label="Dataset"
            value={`${detail.dataset.id} · ${publicText(detail.dataset.title)}`}
          />
          <Fact
            label="Completed"
            value={detail.completed_at ? formatTimestamp(detail.completed_at) : NOT_RECORDED}
          />
        </dl>
      </section>

      <section aria-labelledby="experiment-provenance-heading" data-testid="experiment-provenance">
        <h3
          id="experiment-provenance-heading"
          className="font-heading text-base text-[var(--text)]"
        >
          Dataset and provenance
        </h3>
        {datasetPending ? (
          <p className="mt-2 text-[var(--muted)]">Loading dataset provenance…</p>
        ) : null}
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <Fact
            label="Dataset"
            value={dataset ? publicText(dataset.name) : publicText(detail.dataset.title)}
          />
          <Fact label="Catalog id" value={detail.dataset.id} />
          <Fact
            label="Source"
            value={urlBaseline ? "phreshphish/phreshphish" : displayText(dataset?.source_label)}
          />
          <Fact label="Source revision" value={displayText(version?.source_revision)} />
          <Fact label="Derived profile" value={displayText(version?.derivation_profile)} />
          <Fact
            label="Derivation fingerprint"
            value={displayText(detail.derivation_fingerprint ?? version?.derivation_fingerprint)}
          />
          <Fact
            label="Train"
            value={trainTotal == null ? NOT_RECORDED : formatGrouped(trainTotal)}
          />
          <Fact label="Test" value={testTotal == null ? NOT_RECORDED : formatGrouped(testTotal)} />
          <Fact
            label="Test balance"
            value={
              testCounts
                ? `${testCounts.benign ?? NOT_RECORDED} benign / ${testCounts.phish ?? NOT_RECORDED} phish`
                : NOT_RECORDED
            }
          />
          <Fact
            label="Columns"
            value={
              urlBaseline
                ? "url, label"
                : version?.column_count == null
                  ? NOT_RECORDED
                  : String(version.column_count)
            }
          />
        </dl>
        {urlBaseline ? (
          <div className="mt-4 space-y-2 leading-relaxed text-[var(--text)]">
            <p>The full 36.6 GB source dataset was not ingested.</p>
            <p>
              This experiment used a reproducible derived artifact containing only the required URL
              and label fields.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="experiment-features-heading" data-testid="experiment-features">
        <h3 id="experiment-features-heading" className="font-heading text-base text-[var(--text)]">
          Feature pipeline
        </h3>
        {feature ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact
                label="Character n-grams"
                value={feature.ngramLength == null ? NOT_RECORDED : String(feature.ngramLength)}
              />
              <Fact
                label="Vocabulary"
                value={
                  feature.vocabulary == null ? NOT_RECORDED : formatGrouped(feature.vocabulary)
                }
              />
              <Fact
                label="Maximum"
                value={feature.maximum == null ? NOT_RECORDED : formatGrouped(feature.maximum)}
              />
              <Fact
                label="Minimum count"
                value={feature.minimum == null ? NOT_RECORDED : `>${feature.minimum}`}
              />
              <Fact label="Representation" value={representationLabel(feature.representation)} />
              <Fact label="Vocabulary fit" value={vocabularyFitLabel(feature.vocabularyFit)} />
              <Fact
                label="Unknown test n-grams"
                value={feature.ignoresUnknownTestGrams ? "Ignored" : NOT_RECORDED}
              />
              <Fact
                label="Corrected indexing"
                value={feature.correctedIndexing ? "Enabled" : NOT_RECORDED}
              />
            </dl>
            {feature.vocabularyFit === "train_only" ? (
              <p className="mt-4 leading-relaxed text-[var(--text)]">
                The vocabulary is fit only on training URLs to prevent test-data leakage.
              </p>
            ) : null}
            {feature.correctedIndexing ? (
              <p className="mt-3 leading-relaxed text-[var(--muted)]" data-testid="indexing-note">
                The historical adapted implementation could drop feature index 0 because the lookup
                result was treated as a Boolean, and its n-gram loop omitted the final character
                window. {detail.id} corrects both behaviors.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-[var(--muted)]">{NOT_RECORDED}</p>
        )}
      </section>

      <section aria-labelledby="experiment-model-heading" data-testid="experiment-model">
        <h3 id="experiment-model-heading" className="font-heading text-base text-[var(--text)]">
          Model
        </h3>
        {model ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Fact
              label="Architecture"
              value={
                model.hiddenUnits == null
                  ? NOT_RECORDED
                  : `Input → ${model.hiddenUnits} ${activationLabel(model.activation)} → 1 ${outputLabel(model.output)}`
              }
            />
            <Fact
              label="Parameters"
              value={model.parameters == null ? NOT_RECORDED : formatGrouped(model.parameters)}
            />
            <Fact label="Optimizer" value={optimizerLabel(model.optimizer)} />
            <Fact
              label="Learning rate"
              value={model.learningRate == null ? NOT_RECORDED : formatRate(model.learningRate)}
            />
            <Fact
              label="Epochs"
              value={model.epochs == null ? NOT_RECORDED : String(model.epochs)}
            />
            <Fact
              label="Batch size"
              value={model.batchSize == null ? NOT_RECORDED : String(model.batchSize)}
            />
            <Fact
              label="Threshold"
              value={model.threshold == null ? NOT_RECORDED : formatRate(model.threshold)}
            />
            <Fact label="Seed" value={isUrlFfn(detail) ? "42" : NOT_RECORDED} />
            <Fact label="Runtime" value={deviceLabel(model.device)} />
            <Fact
              label="Framework"
              value={
                model.framework ? `${frameworkLabel(model.framework)} implementation` : NOT_RECORDED
              }
            />
          </dl>
        ) : (
          <p className="mt-3 text-[var(--muted)]">{NOT_RECORDED}</p>
        )}
      </section>

      <section aria-labelledby="experiment-evaluation-heading" data-testid="experiment-evaluation">
        <h3
          id="experiment-evaluation-heading"
          className="font-heading text-base text-[var(--text)]"
        >
          Evaluation
        </h3>
        {evaluation ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Accuracy" value={formatRatio(evaluation.accuracy)} />
              <MetricCard label="Precision" value={formatRatio(evaluation.precision)} />
              <MetricCard label="Recall" value={formatRatio(evaluation.recall)} />
              <MetricCard label="F1" value={formatRatio(evaluation.f1)} />
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <Fact
                label="Phishing caught"
                value={`${evaluation.phishing.caught} / ${evaluation.phishing.support}`}
              />
              <Fact
                label="Benign false positives"
                value={`${evaluation.benignFalsePositives.caught} / ${evaluation.benignFalsePositives.support}`}
              />
            </dl>
            <ConfusionTable counts={evaluation.confusion} />
          </>
        ) : (
          <div className="mt-3 space-y-2">
            <p>No evaluation metrics have been recorded for this experiment.</p>
            {detail.metrics_summary ? (
              <p className="text-[var(--muted)]">
                Stored summary: {publicText(detail.metrics_summary).replace(/[.]+$/, "")}. Stored
                metric text is not a stronger model-performance claim.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {isUrlFfn(detail) && evaluation ? (
        <section
          aria-labelledby="experiment-comparison-heading"
          data-testid="experiment-comparison"
        >
          <h3
            id="experiment-comparison-heading"
            className="font-heading text-base text-[var(--text)]"
          >
            Historical adapted run
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left">
              <caption className="sr-only">
                Observed metrics for the historical adapted run and {detail.id}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="border border-[var(--border)] px-3 py-2">
                    Metric
                  </th>
                  <th scope="col" className="border border-[var(--border)] px-3 py-2">
                    Historical adapted run
                  </th>
                  <th scope="col" className="border border-[var(--border)] px-3 py-2">
                    {detail.id}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="border border-[var(--border)] px-3 py-2 font-medium">
                    Accuracy
                  </th>
                  <td className="border border-[var(--border)] px-3 py-2">{HISTORICAL.accuracy}</td>
                  <td className="border border-[var(--border)] px-3 py-2">
                    {formatRatio(evaluation.accuracy)}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="border border-[var(--border)] px-3 py-2 font-medium">
                    Phishing caught
                  </th>
                  <td className="border border-[var(--border)] px-3 py-2">{HISTORICAL.phishing}</td>
                  <td className="border border-[var(--border)] px-3 py-2">
                    {evaluation.phishing.caught}/{evaluation.phishing.support}
                  </td>
                </tr>
                <tr>
                  <th scope="row" className="border border-[var(--border)] px-3 py-2 font-medium">
                    Benign false positives
                  </th>
                  <td className="border border-[var(--border)] px-3 py-2">
                    {HISTORICAL.falsePositives}
                  </td>
                  <td className="border border-[var(--border)] px-3 py-2">
                    {evaluation.benignFalsePositives.caught}/
                    {evaluation.benignFalsePositives.support}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {evaluation.accuracy > 0.79 &&
          evaluation.phishing.caught > 64 &&
          evaluation.benignFalsePositives.caught > 6 ? (
            <p className="mt-4 leading-relaxed text-[var(--text)]">
              {detail.id} measured higher accuracy and phishing recall, while also producing more
              benign false positives.
            </p>
          ) : null}
          <p className="mt-3 leading-relaxed text-[var(--muted)]">
            These are not directly controlled before-and-after experiments. The sampled rows differ
            and {detail.id} uses a corrected feature pipeline.
          </p>
        </section>
      ) : null}

      {urlBaseline ? (
        <section aria-labelledby="experiment-limits-heading" data-testid="experiment-limits">
          <h3 id="experiment-limits-heading" className="font-heading text-base text-[var(--text)]">
            Limitations
          </h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 leading-relaxed text-[var(--text)]">
            <li>Small derived dataset.</li>
            <li>1,000 training rows.</li>
            <li>200 test rows.</li>
            <li>URL-only features.</li>
            <li>No HTML features.</li>
            <li>No hyperparameter search.</li>
            <li>One seed.</li>
            <li>No confidence interval.</li>
            <li>This is not a reproduction of the full PhreshPhish paper.</li>
            <li>The historical comparison is not controlled.</li>
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="experiment-repro-heading" data-testid="experiment-repro">
        <h3 id="experiment-repro-heading" className="font-heading text-base text-[var(--text)]">
          Reproducibility
        </h3>
        <dl className="mt-4 grid gap-3">
          <Fact label="Source revision" value={displayText(version?.source_revision)} />
          <Fact
            label="Derivation fingerprint"
            value={displayText(detail.derivation_fingerprint ?? version?.derivation_fingerprint)}
          />
          <Fact label="Experiment profile" value={displayText(detail.experiment_profile)} />
          <Fact label="Seed" value={isUrlFfn(detail) ? "42" : NOT_RECORDED} />
          <HashFact label="Model SHA-256" value={detail.model_sha256} />
          <HashFact label="Vocabulary SHA-256" value={detail.vocabulary_sha256} />
          <HashFact label="Experiment manifest SHA-256" value={detail.manifest_sha256} />
        </dl>
        {detail.model_sha256 || detail.vocabulary_sha256 || detail.manifest_sha256 ? (
          <p className="mt-4 text-[var(--muted)]">
            SHA-256 values are integrity hashes, not digital signatures.
          </p>
        ) : null}
      </section>

      {detail.status === "failed" ? (
        <p data-testid="experiment-failed">
          This experiment failed.{" "}
          {detail.notes ? publicText(detail.notes) : "No failure note is stored."}
        </p>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-[var(--text)]">{value}</dd>
    </div>
  );
}

function HashFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-all font-mono text-xs text-[var(--text)]">
        {value ? publicText(value) : NOT_RECORDED}
      </dd>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--raised)] px-3 py-3">
      <p className="text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg text-[var(--text)]">{value}</p>
    </div>
  );
}

function ConfusionTable({
  counts,
}: {
  counts: {
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
    truePositive: number;
  };
}) {
  return (
    <div className="mt-4 overflow-x-auto" data-testid="confusion-matrix">
      <table className="w-full min-w-[22rem] border-collapse text-left">
        <caption className="mb-2 text-left text-[var(--text)]">Confusion matrix</caption>
        <thead>
          <tr>
            <th scope="col" className="border border-[var(--border)] px-3 py-2">
              Actual
            </th>
            <th scope="col" className="border border-[var(--border)] px-3 py-2">
              Predicted benign
            </th>
            <th scope="col" className="border border-[var(--border)] px-3 py-2">
              Predicted phish
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="border border-[var(--border)] px-3 py-2 font-medium">
              Actual benign
            </th>
            <td className="border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2">
              {counts.trueNegative} true negatives
            </td>
            <td className="border border-[var(--border)] px-3 py-2">
              {counts.falsePositive} false positives
            </td>
          </tr>
          <tr>
            <th scope="row" className="border border-[var(--border)] px-3 py-2 font-medium">
              Actual phish
            </th>
            <td className="border border-[var(--border)] px-3 py-2">
              {counts.falseNegative} false negatives
            </td>
            <td className="border border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2">
              {counts.truePositive} true positives
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function statusWord(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "planned") return "Planned";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running";
  if (status === "cancelled") return "Cancelled";
  return publicText(status);
}
