# SubnetForge - Visual CIDR & VPC Architect

SubnetForge is an offline, browser-first visual CIDR calculator, IPAM planner, and VPC architecture assistant. It removes the guesswork from dividing network prefixes, sizing subnets for Kubernetes and database clusters, accounting for cloud provider reserved addresses, and exporting production-ready infrastructure-as-code.

## Why SubnetForge?
- **Visual Address Map**: See your allocated tiers (Public, Private, Database, Management) side-by-side with unallocated free space and immediate visual markers for CIDR collisions.
- **Cloud-Aware**: AWS, GCP, and Azure reserve specific IP addresses inside every subnet (router, DNS, future use, network, broadcast). SubnetForge displays exact usable hosts based on the selected cloud provider profile.
- **Split & Auto-Pack**: Split any subnet into two balanced halves with a single click, or auto-pack unallocated spaces efficiently.
- **Direct Code Generation**: Export instantly to Terraform (`aws_subnet`, `azurerm_subnet`), Ansible YAML, structured JSON, or CSV.
- **100% Local & Private**: No network requests, telemetry, or server dependencies. All state persists in your browser's `localStorage` and can be exported as portable JSON files.

## Quick Start
1. Open `index.html` in any modern desktop or mobile browser.
2. Choose a pre-built architecture preset (e.g., AWS Multi-AZ 3-Tier VPC, Kubernetes Cluster Network) or enter your own root network CIDR (e.g., `10.0.0.0/16`).
3. Add, edit, split, or auto-pack subnets.
4. Copy the generated Terraform HCL, Ansible YAML, JSON, or CSV directly into your infrastructure repository.
