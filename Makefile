# PulseCheck Makefile
#
# One-command operations for the local Kind cluster and Helm chart.
# Run `make help` for a list of targets.

CLUSTER_NAME    := pulsecheck
APP_NAMESPACE   := pulsecheck
INGRESS_NS      := ingress-nginx
KIND_CONFIG     := k8s/kind-config.yaml
INGRESS_VALUES  := k8s/ingress-nginx-values.yaml
COREDNS_PATCH   := k8s/coredns-patch.yaml
CHART_DIR       := helm/pulsecheck
SECRETS_FILE    := helm/pulsecheck/values-secrets.yaml

IMAGE_TAG       := 0.1.0
FRONTEND_IMAGE  := pulsecheck-frontend:$(IMAGE_TAG)
API_IMAGE       := pulsecheck-api:$(IMAGE_TAG)
WORKER_IMAGE    := pulsecheck-worker:$(IMAGE_TAG)

NODES := $(CLUSTER_NAME)-control-plane $(CLUSTER_NAME)-worker $(CLUSTER_NAME)-worker2 $(CLUSTER_NAME)-worker3

.DEFAULT_GOAL := help
.PHONY: help cluster-up cluster-down cluster-pause cluster-resume \
        build-images load-images deploy redeploy check-prereqs check-secrets

## help: List available targets with descriptions
help:
	@echo "PulseCheck Makefile targets:"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed -e 's/## /  /'
	@echo ""

## cluster-up: Build the Kind cluster from scratch and deploy the full app
cluster-up: check-prereqs check-secrets
	@echo "==> Creating Kind cluster '$(CLUSTER_NAME)'"
	kind create cluster --config $(KIND_CONFIG)
	@echo "==> Installing ingress-nginx pinned to the edge worker"
	helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
	helm repo update >/dev/null
	helm install ingress-nginx ingress-nginx/ingress-nginx \
	  --namespace $(INGRESS_NS) --create-namespace \
	  -f $(INGRESS_VALUES) --wait --timeout 5m
	@echo "==> Rescheduling CoreDNS onto app workers with anti-affinity"
	kubectl patch deployment coredns -n kube-system --patch-file $(COREDNS_PATCH)
	kubectl rollout status deployment/coredns -n kube-system --timeout 2m
	@echo "==> Installing metrics-server (required for HPA)"
	helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/ >/dev/null 2>&1 || true
	helm repo update >/dev/null
	helm install metrics-server metrics-server/metrics-server \
	  --namespace kube-system \
	  --set 'args={--kubelet-insecure-tls}' \
	  --wait --timeout 2m
	$(MAKE) build-images
	$(MAKE) load-images
	@echo "==> Installing the pulsecheck Helm chart"
	kubectl create namespace $(APP_NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	helm upgrade --install pulsecheck $(CHART_DIR) \
	  --namespace $(APP_NAMESPACE) \
	  -f $(SECRETS_FILE) --wait --timeout 5m
	@echo ""
	@echo "==> Cluster is up. App reachable at http://pulsecheck.local"
	@echo "    (add to /etc/hosts: 127.0.0.1 pulsecheck.local)"

## cluster-down: Destroy the Kind cluster and all its state
cluster-down:
	kind delete cluster --name $(CLUSTER_NAME)

## cluster-pause: Stop all cluster node containers without destroying state
cluster-pause:
	docker stop $(NODES)

## cluster-resume: Start the previously paused cluster node containers
cluster-resume:
	docker start $(NODES)
	@echo "==> Waiting for nodes to be Ready"
	@until kubectl get nodes 2>/dev/null | grep -q "Ready"; do sleep 2; done
	@kubectl get nodes

## build-images: Build the frontend, api, and worker prod images locally
build-images:
	@echo "==> Building $(FRONTEND_IMAGE)"
	docker build --target prod -t $(FRONTEND_IMAGE) ./frontend
	@echo "==> Building $(API_IMAGE)"
	docker build --target prod -f api/Dockerfile -t $(API_IMAGE) .
	@echo "==> Building $(WORKER_IMAGE)"
	docker build --target prod -f worker/Dockerfile -t $(WORKER_IMAGE) .

## load-images: Load the built images into the Kind cluster nodes
load-images:
	kind load docker-image $(FRONTEND_IMAGE) $(API_IMAGE) $(WORKER_IMAGE) --name $(CLUSTER_NAME)

## deploy: Helm upgrade the pulsecheck chart (use after chart or values changes)
deploy: check-secrets
	helm upgrade --install pulsecheck $(CHART_DIR) \
	  --namespace $(APP_NAMESPACE) \
	  -f $(SECRETS_FILE) --wait --timeout 5m

## redeploy: Rebuild images, reload into Kind, and roll the app deployments
redeploy: build-images load-images
	@echo "==> Restarting deployments so they pick up the new images"
	kubectl rollout restart -n $(APP_NAMESPACE) deployment/pulsecheck-frontend deployment/pulsecheck-api deployment/pulsecheck-worker
	kubectl rollout status -n $(APP_NAMESPACE) deployment/pulsecheck-frontend --timeout 2m
	kubectl rollout status -n $(APP_NAMESPACE) deployment/pulsecheck-api --timeout 2m
	kubectl rollout status -n $(APP_NAMESPACE) deployment/pulsecheck-worker --timeout 2m

check-prereqs:
	@for cmd in kind kubectl helm docker; do \
	  command -v $$cmd >/dev/null || { echo "ERROR: $$cmd not found in PATH"; exit 1; }; \
	done
	@docker info >/dev/null 2>&1 || { echo "ERROR: Docker daemon is not running"; exit 1; }

check-secrets:
	@test -f $(SECRETS_FILE) || { echo "ERROR: $(SECRETS_FILE) missing (copy $(CHART_DIR)/values-secrets.example.yaml and fill in real values)"; exit 1; }
