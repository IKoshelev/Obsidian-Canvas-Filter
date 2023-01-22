import { CanvasData } from 'canvas';
import { App, Editor, ItemView, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
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

				const nodes = canvasData.nodes;
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

				for (const node of nodes) {
					canvas.nodes.get(node.id).nodeEl.hide()
				}

				for (const node of nodes) {
					if (!colorsToShow.has(node.color ?? "")) {
						continue;
					}
					const currentNode = canvas.nodes.get(node.id);
					currentNode.nodeEl.show();
					debugger;
					const containingNodes = canvas.getContainingNodes(currentNode.bbox);
					console.log(currentNode.label, containingNodes.map(x => x.label));
					const containingGroups = containingNodes.filter(n => n.type === 'group');
												
					for (const containingGroup of containingGroups) {
						containingGroup.nodeEl.show();
					}
				}

				// Check if node exist
				//const slideNode = canvas.nodes.get(node.id);

				//canvas.nodes.get(selectedNode.id).nodeEl.hide()

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
