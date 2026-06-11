{{- define "ufrm.name" -}}uf-research-metrics{{- end -}}
{{- define "ufrm.fullname" -}}{{ .Release.Name }}{{- end -}}

{{- define "ufrm.labels" -}}
app.kubernetes.io/part-of: uf-research-metrics
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "ufrm.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- end -}}

{{/* Full image ref for a component: registry/repo:tag */}}
{{- define "ufrm.image" -}}
{{- $img := index .root.Values.image .component -}}
{{- printf "%s/%s:%s" (trimSuffix "/" .root.Values.image.registry) $img (.root.Values.image.tag | toString) -}}
{{- end -}}
