"""Trusted research-dataset sources. Download targets are not taken from requests."""

from dataclasses import dataclass

PHRESHPHISH_ID = "DS-0006"
PHRESHPHISH_REPO = "phreshphish/phreshphish"
HUGGINGFACE_HOSTS = frozenset(
    {
        "huggingface.co",
        "cdn-lfs.huggingface.co",
        "cdn-lfs-us-1.huggingface.co",
        "cas-bridge.xethub.hf.co",
        "transfer.xethub.hf.co",
    }
)


@dataclass(frozen=True)
class ApprovedDataset:
    dataset_id: str
    source_type: str
    repository: str


APPROVED_DATASETS = {
    PHRESHPHISH_ID: ApprovedDataset(
        dataset_id=PHRESHPHISH_ID,
        source_type="huggingface",
        repository=PHRESHPHISH_REPO,
    )
}


def approved_dataset(dataset_id: str) -> ApprovedDataset:
    row = APPROVED_DATASETS.get(dataset_id.strip())
    if row is None:
        raise KeyError(dataset_id)
    return row
