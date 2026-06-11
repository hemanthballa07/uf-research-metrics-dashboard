# Phase 1 demo lifecycle. Teardown-first: `make demo-up` to provision + deploy for a demo,
# `make demo-down` to destroy everything afterwards. Requires: terraform, aws, kubectl, helm.
#
# Override on the CLI, e.g.: make demo-up ENV=demo REGION=us-east-1 IMAGE_TAG=$(git rev-parse --short HEAD)

ENV        ?= demo
REGION     ?= us-east-1
NAMESPACE  ?= uf-research-metrics
RELEASE    ?= ufrm
IMAGE_TAG  ?= latest
TF_DIR     := infra/terraform
CHART      := infra/helm/uf-research-metrics

CLUSTER    = uf-research-metrics-$(ENV)-eks

.PHONY: tf-init tf-plan tf-apply tf-output kubeconfig platform deploy demo-up demo-down

tf-init:
	cd $(TF_DIR) && terraform init

tf-plan: tf-init
	cd $(TF_DIR) && terraform plan -var env=$(ENV) -var aws_region=$(REGION)

tf-apply: tf-init
	cd $(TF_DIR) && terraform apply -auto-approve -var env=$(ENV) -var aws_region=$(REGION)

kubeconfig:
	aws eks update-kubeconfig --name $(CLUSTER) --region $(REGION)

# Install the platform charts (separate releases the app chart depends on at runtime).
platform:
	helm repo add eks https://aws.github.io/eks-charts
	helm repo add bitnami https://charts.bitnami.com/bitnami
	helm repo add redpanda https://charts.redpanda.com
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
	helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
	helm repo add external-secrets https://charts.external-secrets.io
	helm repo update
	helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
	  -n kube-system --set clusterName=$(CLUSTER)
	helm upgrade --install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
	helm upgrade --install redis bitnami/redis -n $(NAMESPACE) --create-namespace --set architecture=standalone
	helm upgrade --install redpanda redpanda/redpanda -n $(NAMESPACE) --create-namespace
	helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace
	helm upgrade --install jaeger jaegertracing/jaeger -n $(NAMESPACE) --set provisionDataStore.cassandra=false --set allInOne.enabled=true --set storage.type=memory

# Deploy the app chart. ECR registry comes from terraform output.
deploy: kubeconfig
	$(eval REGISTRY := $(shell cd $(TF_DIR) && terraform output -raw ecr_repository_urls 2>/dev/null | sed 's#/uf-research-metrics/.*##' | head -1))
	helm upgrade --install $(RELEASE) $(CHART) -n $(NAMESPACE) --create-namespace \
	  -f $(CHART)/values-$(ENV).yaml \
	  --set image.registry=$(REGISTRY) --set image.tag=$(IMAGE_TAG)

demo-up: tf-apply kubeconfig platform deploy
	@echo "Demo up. Ingress ALB address:"
	kubectl -n $(NAMESPACE) get ingress $(RELEASE) -o jsonpath='{.status.loadBalancer.ingress[0].hostname}{"\n"}' || true

demo-down:
	-helm uninstall $(RELEASE) -n $(NAMESPACE)
	-helm uninstall jaeger redpanda redis -n $(NAMESPACE)
	-helm uninstall kube-prometheus-stack -n monitoring
	cd $(TF_DIR) && terraform destroy -auto-approve -var env=$(ENV) -var aws_region=$(REGION)
