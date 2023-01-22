import { CanvasData, CanvasNodeData } from 'canvas';
import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export function nodeBondingBoxContains(outerNode: CanvasNodeData, innerNode: CanvasNodeData) {
	return outerNode.x <= innerNode.x
			&& (outerNode.x + outerNode.width) >= (innerNode.x + innerNode.width)
			&& outerNode.y <= innerNode.y
			&& (outerNode.y + outerNode.height) >= (innerNode.y + innerNode.height);
}

export function showOnlyNodes(canvas: any, idsToShow: Set<string>) {

}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	private currentView: ItemView;

	async onload() {

		this.addCommand({
			id: 'show-only-same-color',
			name: 'Show only same color items',
			checkCallback: (checking: boolean) => {
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

				this.currentView = canvasView;

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

				for (const node of nodes) {
					canvas.nodes.get(node.id).nodeEl.hide()
				}

				const fileNodesToShow = 
					nodes.filter(x => x.type === 'file' 
									&& colorsToShow.has(x.color ?? ""));

				const groupNodesToShow = 
					nodes.filter(x => x.type === 'group' 
					&& fileNodesToShow.some(fn => nodeBondingBoxContains(x, fn)));

				for (const node of [...fileNodesToShow, ...groupNodesToShow]) {
					const nodeOnCanvas = canvas.nodes.get(node.id);					
					nodeOnCanvas.nodeEl.show();
				}

				const shownNodeIds = new Set([...fileNodesToShow, ...groupNodesToShow].map(x => x.id));
				const edges = canvasData.edges;

				for (const edge of edges) {
					const edgeOnCanvas = canvas.edges.get(edge.id);
					if (shownNodeIds.has(edge.fromNode) && shownNodeIds.has(edge.toNode)) {
						delete edgeOnCanvas.lineGroupEl.style.display;
					} else {
						edgeOnCanvas.lineGroupEl.style.display = "none";
					}
				}
			}
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
