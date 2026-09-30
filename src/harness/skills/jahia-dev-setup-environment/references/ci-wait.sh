#!/bin/sh
# The pipeline runs the same Compose file and manifest as the developers. Wait for the manifest
# before the tests start, otherwise they run against an instance with neither modules nor site.
set -e
docker compose up --wait
# Wait for the manifest, and fail the job if it never finishes
timeout 300 sh -c 'until docker compose logs jahia | grep -q "999-docker-provisioning.yaml : .installed"; do sleep 5; done'
# Fail the job on an operation that failed inside the manifest.
# Written as `grep && exit 1`: a negated pipeline (`! grep`) is exempt from `set -e`
docker compose logs jahia | grep ' : .failed' && exit 1
# build the modules, deploy them, then run the tests against http://localhost:8080
docker compose down --volumes
