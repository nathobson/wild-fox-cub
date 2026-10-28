import { EditableText } from '../../components/editing/EditableText';
import { IconLayout } from '../../components/icons';
import { ItemList } from '../../components/ui/ItemList';
import { defineBlock, type BlockInspectorProps, type BlockViewProps } from '../../lib/blocks';
import { AnchorField, anchorId, Arrow, Label, Lines, newId, patchItem, PicField, Picture, Tags, TextRow, ToneField, type Pic, type Tone } from '../shared';

export interface Project {
  id: string;
  name: string;
  kind: string;
  summary: string;
  tags: string;
  href: string;
  image: Pic;
}

export interface WorkBlock {
  id: string;
  type: 'work';
  anchor?: string;
  tone: Tone;
  eyebrow: string;
  heading: string;
  intro: string;
  linkLabel: string;
  projects: Project[];
}

/** Selected projects: large framed screens that drift inside their frames, alternating sides. */
function WorkView({ block, editable, onUpdate }: BlockViewProps<WorkBlock>) {
  const update = (id: string, patch: Partial<Project>) => onUpdate({ projects: patchItem(block.projects, id, patch) });
  return (
    <section id={anchorId(block.anchor)} className={`wf-work wf-section tone-${block.tone}`} data-scroll data-tone={block.tone}>
      <header className="wf-work-head" data-reveal>
        <Label value={block.eyebrow} editable={editable} onChange={(eyebrow) => onUpdate({ eyebrow })} />
        <Lines className="wf-display wf-offset" value={block.heading} editable={editable} placeholder="Heading" onChange={(heading) => onUpdate({ heading })} />
        <EditableText as="p" className="wf-small wf-work-intro" value={block.intro} editable={editable} multiline placeholder="Intro" onChange={(intro) => onUpdate({ intro })} />
      </header>
      <ol className="wf-projects">
        {block.projects.map((project, i) => {
          const Frame = editable || !project.href ? 'div' : 'a';
          return (
            <li key={project.id} className={`wf-project ${i % 2 ? 'flip' : ''}`} data-scroll>
              <Frame className="wf-project-frame" {...(Frame === 'a' ? { href: project.href, 'aria-label': project.name } : {})}>
                <Picture pic={project.image} sizes="(min-width: 900px) 62vw, 92vw" className="parallax-sm" />
              </Frame>
              <div className="wf-project-copy" data-reveal>
                <Label value={project.kind} editable={editable} onChange={(kind) => update(project.id, { kind })} />
                <EditableText as="h3" className="wf-display wf-project-name" value={project.name} editable={editable} placeholder="Project" onChange={(name) => update(project.id, { name })} />
                <EditableText as="p" className="wf-small" value={project.summary} editable={editable} multiline placeholder="One line about it" onChange={(summary) => update(project.id, { summary })} />
                <Tags value={project.tags} editable={editable} onChange={(tags) => update(project.id, { tags })} />
                {!editable && project.href && (
                  <a className="wf-link" href={project.href}>
                    <span>{block.linkLabel}</span> <Arrow />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function WorkInspector({ block, onUpdate }: BlockInspectorProps<WorkBlock>) {
  return (
    <>
      <ToneField value={block.tone} onChange={(tone) => onUpdate({ tone })} />
      <TextRow label="Label" value={block.eyebrow} onChange={(eyebrow) => onUpdate({ eyebrow })} />
      <TextRow label="Link text" value={block.linkLabel} onChange={(linkLabel) => onUpdate({ linkLabel })} />
      <ItemList
        items={block.projects}
        onChange={(projects) => onUpdate({ projects })}
        label={(project) => project.name || 'Project'}
        thumb={(project) => project.image.src || null}
        editor={(project, update) => (
          <>
            <TextRow label="Name" value={project.name} onChange={(name) => update({ name })} />
            <TextRow label="Kind" value={project.kind} onChange={(kind) => update({ kind })} />
            <TextRow label="Summary" value={project.summary} onChange={(summary) => update({ summary })} />
            <TextRow label="Tags" value={project.tags} placeholder="Comma-separated" onChange={(tags) => update({ tags })} />
            <TextRow label="Link" value={project.href} placeholder="/work/…" onChange={(href) => update({ href })} />
            <PicField pic={project.image} onChange={(image) => update({ image })} />
          </>
        )}
        create={() => ({ id: newId(), name: 'New project', kind: 'Product', summary: '', tags: '', href: '', image: { src: '', alt: '' } })}
        addLabel="Add project"
      />
      <AnchorField value={block.anchor} onChange={(anchor) => onUpdate({ anchor })} />
    </>
  );
}

export const workBlock = defineBlock<WorkBlock>({
  type: 'work',
  label: 'Work',
  description: 'Selected projects with large screenshots',
  icon: IconLayout,
  images: true,
  create: () => ({
    type: 'work',
    tone: 'light',
    eyebrow: 'Selected work',
    heading: 'Things we’ve\ngrown lately.',
    intro: '',
    linkLabel: 'View project',
    projects: [],
  }),
  View: WorkView,
  Inspector: WorkInspector,
});
