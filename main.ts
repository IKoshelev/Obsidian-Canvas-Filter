import { CanvasData, CanvasNodeData } from 'canvas';
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

	async onload() {

		this.addCommand({
			id: 'show-all',
			name: 'Show all nodes and groups',
			checkCallback: this.ifActiveViewIsCanvas((canvas, canvasData) => {

				showOnlyNodes(canvas);

				showOnlyEdges(canvas);
			})
		});

		this.addCommand({
			id: 'show-only-same-color',
			name: 'Show only same color nodes and their groups',
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

				const fileNodesToShow =
					nodes.filter(x => x.type === 'file'
						&& colorsToShow.has(x.color ?? ""));

				const groupNodesToShow =
					nodes.filter(x => x.type === 'group'
						&& fileNodesToShow.some(fn => nodeBondingBoxContains(x, fn)));

				const shownNodeIds = new Set([...fileNodesToShow, ...groupNodesToShow].map(x => x.id));
				showOnlyNodes(canvas, shownNodeIds);

				const shownEdgeIds = new Set(canvasData.edges
					.filter(edge => shownNodeIds.has(edge.fromNode)
						&& shownNodeIds.has(edge.toNode))
					.map(x => x.id))

				showOnlyEdges(canvas, shownEdgeIds);
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
