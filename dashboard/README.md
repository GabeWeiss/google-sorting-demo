# Google Edge TPU Display

## Architecture
* Bitbucket pipeline
* Docker onsite
* Two environments
* Let's encrypt
* Image stamping for onsite

---
## Helm Install
The provided Helm chart is used to install the application into Kubernetes. The same chart can be used to create different environments (development, staging, production). The default values/configuration packaged into the Helm chart will create the `staging` environment. To create the other environments either use the `--set` flag using the values from the `environment/values` map or use can use alternative values files `dev-values.yaml` or `qa-values.yaml` if provided.

*Be sure to add the remote repo if you don't have it already*
```
// helm repo add <name> <URL>
$ helm repo add 2224 gs://next19-edgeml/2224
$ helm update
```


*Make sure to a add Route53 A record pointing to your ingress controller's IP address*
#### environment/values map
| Value | development | stagging | 
| --- | ---| --- |
|labels.environment | `development` |  `staging` (*default*)
|ingress.host | `dev-gn19-edgetpu.sparkspreview.com` | `gn19-edgetpu.sparkspreview.com` (*default*)

Create a namespace
```
$ kubectl create namespace 2224-google-next-edge-tpu-display
```

Install chart from remote repo
```
// Staging
$ helm install --name qa-google-next-edge-tpu-displaye --namespace 2224-google-next-edge-tpu-display 2224/google_next_edge_tpu_display

// Development with --set
$ helm install --name dev-google-next-edge-tpu-display --set 'ingress.host=dev-gn19-contextaware.sparkspreview.com,labels.environment=development' --namespace 2224-google-next-edge-tpu-display 2224/google_next_edge_tpu_display
```

Install chart from local chart
```
// Development with alternative values file
$ helm install --name dev-google-next-edge-tpu-display -f google_next_edge_tpu_display/ --namespace 2224-google-next-edge-tpu-display google_next_edge_tpu_display/
```
