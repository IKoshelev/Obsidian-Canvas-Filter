import { CanvasData, CanvasEdgeData, CanvasFileData, CanvasLinkData, CanvasNodeData, CanvasTextData } from 'obsidian/canvas';
import { App, FuzzySuggestModal, getAllTags, ItemView, Notice, Plugin } from 'obsidian';

export interface CanvasGroupData extends CanvasNodeData {
	type: 'group',
	label: string
}

function isCanvasGroupData(node: CanvasNodeData): node is CanvasGroupData {
	return (node as any)?.type === 'group';
}

function nodeBondingBoxContains(outerNode: CanvasNodeData, innerNode: CanvasNodeData) {
	return outerNode.x <= innerNode.x
		&& (outerNode.x + outerNode.width) >= (innerNode.x + innerNode.width)
		&& outerNode.y <= innerNode.y
		&& (outerNode.y + outerNode.height) >= (innerNode.y + innerNode.height);
}

function showOnlyNodes(canvas: any, idsToShow?: Set<string>) {
	const nodes = canvas.nodes.values();

	for (const node of nodes) {
		if (idsToShow === undefined || idsToShow.has(node.id)) {
			node.nodeEl.show();
		} else {
			node.nodeEl.hide();
		}
	}
}

function showOnlyEdges(canvas: any, idsToShow?: Set<string>) {
	const edges = canvas.edges.values();

	for (const edge of edges) {
		if (idsToShow === undefined || idsToShow.has(edge.id)) {
			edge.lineGroupEl.style.display = "";
			edge.lineEndGroupEl.style.display = "";
		} else {
			edge.lineGroupEl.style.display = "none";
			edge.lineEndGroupEl.style.display = "none";
		}
	}
}

function getGroupsFor(allNodes: CanvasNodeData[], nonGroupNodes: CanvasNodeData[]) {
	return allNodes.filter(x => isCanvasGroupData(x)
		&& nonGroupNodes.some(fn => nodeBondingBoxContains(x, fn)));
}

function getEdgesWhereBothNodesInSet(allEdges: CanvasEdgeData[], nodeIds: Set<string>) {
	return allEdges
		.filter(edge => nodeIds.has(edge.fromNode)
			&& nodeIds.has(edge.toNode));
}

export default class CanvasFilterPlugin extends Plugin {

	private ifActiveViewIsCanvas = (commandFn: (canvas: any, canvasData: CanvasData) => void) => (checking: boolean) => {
		const canvasView = this.app.workspace.getActiveViewOfType(ItemView);

		if (canvasView?.getViewType() !== 'canvas') {
			if (checking) {
				return false;
			}
			return;
		}

		if (checking) {
			return true;
		}

		const canvas = (canvasView as any).canvas;
		if (!canvas) {
			return;
		};

		const canvasData = canvas.getData() as CanvasData;

		if (!canvasData) {
			return;
		};

		return commandFn(canvas, canvasData);
	}

	private showConnectedNodes = (
		canvas: any,
		canvasData: CanvasData,
		showUpstreamNodes: boolean,
		showDownstreamNodes: boolean) => {
		const selection: any = Array.from(canvas.selection);
		if (selection.length === 0) {
			new Notice("Please select at least one node");
			return;
		}

		const nodesIdsToShow = new Set(selection.map((x: any) => x.id).filter((x: any) => x) as string[]);
		const edgesIdsToShow = new Set<string>();
		const addedNodes = new Set(nodesIdsToShow);
		while (addedNodes.size > 0) {
			const previousAddedNodes = new Set(addedNodes);
			addedNodes.clear();

			if (showUpstreamNodes) {
				const outgoingEdges = canvasData.edges.filter(x => previousAddedNodes.has(x.fromNode));
				for (const edge of outgoingEdges) {
					edgesIdsToShow.add(edge.id);
					if (!nodesIdsToShow.has(edge.toNode)) {
						nodesIdsToShow.add(edge.toNode);
						addedNodes.add(edge.toNode);
					}
				}
			}

			if (showDownstreamNodes) {
				const incomingEdges = canvasData.edges.filter(x => previousAddedNodes.has(x.toNode));
				for (const edge of incomingEdges) {
					edgesIdsToShow.add(edge.id);
					if (!nodesIdsToShow.has(edge.fromNode)) {
						nodesIdsToShow.add(edge.fromNode);
						addedNodes.add(edge.fromNode);
					}
				}
			}
		}

		const groupNodesToShow = getGroupsFor(
			canvasData.nodes,
			canvasData.nodes.filter(x => nodesIdsToShow.has(x.id)));

		for (const node of groupNodesToShow) {
			nodesIdsToShow.add(node.id);
		}

		showOnlyNodes(canvas, nodesIdsToShow);

		showOnlyEdges(canvas, edgesIdsToShow);
	}

	async onload() {

		this.addCommand({
			id: 'show-all',
			name: 'show ALL',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				showOnlyNodes(canvas);

				showOnlyEdges(canvas);
			})
		});

		this.addCommand({
			id: 'show-only-same-color',
			name: 'show matching COLOR',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				const selection: any = Array.from(canvas.selection);
				if (selection.length === 0) {
					new Notice("Please select at least one node");
					return;
				}

				const colorsToShow = new Set(selection.map((x: any) => x.color) as (string | undefined)[]);

				if (colorsToShow.has("")) {
					new Notice("One of selected nodes has no color, so colorless nodes will be visible");
				}

				const nodes = canvasData.nodes;

				const nonGroupNodesToShow =
					nodes.filter((x: CanvasFileData | CanvasTextData | CanvasLinkData | CanvasGroupData) => x.type !== 'group'
						&& colorsToShow.has(x.color ?? ""));

				const groupNodesToShow = getGroupsFor(nodes, nonGroupNodesToShow);

				const shownNodeIds = new Set([...nonGroupNodesToShow, ...groupNodesToShow].map(x => x.id));
				showOnlyNodes(canvas, shownNodeIds);

				const shownEdgeIds = new Set(
					getEdgesWhereBothNodesInSet(canvasData.edges, shownNodeIds).map(x => x.id))

				showOnlyEdges(canvas, shownEdgeIds);
			})
		});

		this.addCommand({
			id: 'show-hide',
			name: 'selected HIDE',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				const selection: any = Array.from(canvas.selection);
				if (selection.length === 0) {
					new Notice("Please select at least one node");
					return;
				}

				for (const selected of selection) {
					const node = canvas.nodes.get(selected.id);
					if (node) {
						node.nodeEl.hide();
					}
					const edge = canvas.edges.get(selected.id);
					if (edge) {
						edge.lineGroupEl.style.display = "none";
						edge.lineEndGroupEl.style.display = "none";
					}
				}

				canvas.deselectAll();
			})
		});

		this.addCommand({
			id: 'show-hide-connected',
			name: 'selected with connections HIDE',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				const selection: any = Array.from(canvas.selection);
				if (selection.length === 0) {
					new Notice("Please select at least one node");
					return;
				}

				for (const selected of selection) {
					const node = canvas.nodes.get(selected.id);
					if (node) {
						node.nodeEl.hide();
						const connections = canvasData.edges.filter(x => x.fromNode === node.id || x.toNode === node.id); 
						for (const connection of connections) {
							const edge = canvas.edges.get(connection.id);
							edge.lineGroupEl.style.display = "none";
							edge.lineEndGroupEl.style.display = "none";
						}
					}
					
					const edge = canvas.edges.get(selected.id);
					if (edge) {
						edge.lineGroupEl.style.display = "none";
						edge.lineEndGroupEl.style.display = "none";
					}
				}

				canvas.deselectAll();
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-from-to',
			name: 'show with ARROWS TO/FROM',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, true, true);
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-from',
			name: 'show with ARROWS FROM',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, true, false);
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-to',
			name: 'show with ARROWS TO',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, false, true);
			})
		});

		this.addCommand({
			id: 'show-tags',
			name: 'by TAG',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				const tagsObject = (this.app.metadataCache as any).getTags() as Record<string, number>;
				const tags = Object.keys(tagsObject);

				const cardTags = canvasData.nodes
					.flatMap(x => {
						if (x.type !== "text") {
							return [];
						}
						return [...x.text.matchAll(/#[^\s]+/g)].map(x => x[0]);
					});

				new TagSelectionModal(
					this.app,
					[...new Set([...tags, ...cardTags])],
					(tag: string) => {

						const nodesToShow = canvasData.nodes.filter(node => {

							if (node.type === "file") {
								const metadata = this.app.metadataCache.getCache(node.file);
								return metadata?.tags?.some(x => x.tag === tag);
								// TODO search subpaths?
							}

							if (node.type === "text") {
								return node.text.indexOf(tag) !== -1;
							}

							return false;
						});

						const groupsToShow = getGroupsFor(canvasData.nodes, nodesToShow);

						const nodeIdsToShow = new Set(nodesToShow.map(x => x.id));

						const edgesToShow = getEdgesWhereBothNodesInSet(canvasData.edges, nodeIdsToShow);

						for (const group of groupsToShow) {
							nodeIdsToShow.add(group.id);
						}

						showOnlyNodes(canvas, nodeIdsToShow);

						showOnlyEdges(canvas, new Set(edgesToShow.map(x => x.id)));

					}).open();
			})
		});
	}
}

class TagSelectionModal extends FuzzySuggestModal<string> {

	constructor(
		app: App,
		private tags: string[],
		private onSelect: (tag: string) => void) {
		super(app);
	}

	getItems(): string[] {
		return this.tags;
	}
	getItemText(item: string): string {
		return item;
	}
	onChooseItem(item: string, evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
	}

}
