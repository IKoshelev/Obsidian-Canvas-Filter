import { AllCanvasNodeData, CanvasData, CanvasNodeData } from 'canvas';
import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';


interface CanvasFilterPluginSettings {
	// mySetting: string;
}

const DEFAULT_SETTINGS: CanvasFilterPluginSettings = {
	// mySetting: 'default'
}

export function nodeBondingBoxContains(outerNode: CanvasNodeData, innerNode: CanvasNodeData) {
	return outerNode.x <= innerNode.x
		&& (outerNode.x + outerNode.width) >= (innerNode.x + innerNode.width)
		&& outerNode.y <= innerNode.y
		&& (outerNode.y + outerNode.height) >= (innerNode.y + innerNode.height);
}

export function showOnlyNodes(canvas: any, idsToShow?: Set<string>) {
	const nodes = canvas.nodes.values();

	for (const node of nodes) {
		if (idsToShow === undefined || idsToShow.has(node.id)) {
			node.nodeEl.show();
		} else {
			node.nodeEl.hide();
		}
	}
}

export function showOnlyEdges(canvas: any, idsToShow?: Set<string>) {
	const edges = canvas.edges.values();

	for (const edge of edges) {
		if (idsToShow === undefined || idsToShow.has(edge.id)) {
			edge.lineGroupEl.style.display = "";
			edge.markerGroupEl.style.display = "";
		} else {
			edge.lineGroupEl.style.display = "none";
			edge.markerGroupEl.style.display = "none";
		}
	}
}

function getGroupsFor(allNodes: AllCanvasNodeData[], nonGroupNodes: AllCanvasNodeData[]) {
	return allNodes.filter(x => x.type === 'group'
		&& nonGroupNodes.some(fn => nodeBondingBoxContains(x, fn)));
}

export default class CanvasFilterPlugin extends Plugin {

	settings: CanvasFilterPluginSettings;

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
			name: 'Show nodes and groups: ALL',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				showOnlyNodes(canvas);

				showOnlyEdges(canvas);
			})
		});

		this.addCommand({
			id: 'show-only-same-color',
			name: 'Show nodes and groups: match selected COLOR',
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
					nodes.filter(x => x.type !== 'group'
						&& colorsToShow.has(x.color ?? ""));

				const groupNodesToShow = getGroupsFor(nodes, nonGroupNodesToShow);

				const shownNodeIds = new Set([...nonGroupNodesToShow, ...groupNodesToShow].map(x => x.id));
				showOnlyNodes(canvas, shownNodeIds);

				const shownEdgeIds = new Set(canvasData.edges
					.filter(edge => shownNodeIds.has(edge.fromNode)
						&& shownNodeIds.has(edge.toNode))
					.map(x => x.id))

				showOnlyEdges(canvas, shownEdgeIds);
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-from-to',
			name: 'Show nodes and groups: selected ARROWS TO/FROM',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, true, true)
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-from',
			name: 'Show nodes and groups: selected ARROWS FROM',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, true, false)
			})
		});

		this.addCommand({
			id: 'show-connected-nodes-to',
			name: 'Show nodes and groups: selected ARROWS TO',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {
				this.showConnectedNodes(canvas, canvasData, false, true)
			})
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
