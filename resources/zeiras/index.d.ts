import type * as React from 'react';

export type Tone = 'pine' | 'citrus' | 'coral' | 'sky' | 'plum' | 'neutral';
export type IconName = 'menu' | 'home' | 'grid' | 'folder' | 'board' | 'users' | 'megaphone' | 'search' | 'plus' | 'calendar' | 'checklist' | 'message' | 'bell' | 'settings' | 'more' | 'chevron' | 'arrow' | 'filter' | 'list' | 'clock' | 'close' | 'share' | 'chart' | 'bolt' | 'sparkle' | 'mail' | 'phone' | 'building' | 'euro' | 'trendUp' | 'trendDown' | 'download' | 'upload' | 'edit' | 'trash' | 'copy' | 'refresh' | 'play' | 'pause' | 'eye' | 'link' | 'tag' | 'star' | 'info' | 'alert' | 'checkCircle' | 'xCircle' | 'split' | 'user' | 'globe' | 'sort' | 'chevronDown' | 'chevronLeft' | 'check' | 'file' | 'form' | 'target' | 'gantt';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: IconName }
export declare function Button(props: ButtonProps): React.ReactElement;

export interface LabelProps { tone?: Tone; children?: React.ReactNode; className?: string }
export declare function Label(props: LabelProps): React.ReactElement;

export interface AvatarProps { name: string; size?: 'sm' | 'md' | 'lg'; tone?: Exclude<Tone, 'neutral'> }
export declare function Avatar(props: AvatarProps): React.ReactElement;
export interface AvatarStackProps { people: string[]; max?: number; size?: 'sm' | 'md' | 'lg' }
export declare function AvatarStack(props: AvatarStackProps): React.ReactElement;
export declare function Icon(props: { name: IconName; size?: number; className?: string }): React.ReactElement;

export interface NavItem { id: string; label: string; icon: IconName; soon?: boolean; count?: number; href?: string }
export interface AppShellLabels { soon?: string; settings?: string; planTitle?: string; planText?: string; nav?: string; openMenu?: string; closeMenu?: string; userFallback?: string; create?: string; workspaceSwitch?: string; newWorkspace?: string; search?: string; searchPlaceholder?: string; searchHint?: string; searchLoading?: string; searchEmpty?: string; searchEmptyText?: string; searchError?: string; searchResults?: string; notifications?: string; unread?: string; forMe?: string; all?: string; markAllRead?: string; seeAll?: string; notificationsEmpty?: string; notificationsEmptyText?: string; notificationsError?: string; retry?: string; loading?: string; account?: string; profile?: string; accountSettings?: string; plan?: string; company?: string; logout?: string; crumbs?: string }
export interface ShellWorkspace { slug: string; name: string; tone?: Exclude<Tone, 'neutral'> }
export interface ShellCompany { id: string; name: string; workspaces: ShellWorkspace[] }
export interface ShellNotification { id: string; title: string; text?: string; time?: string; product?: string; unread?: boolean; /** false = compare solo in «Tutte» */ forMe?: boolean; actor?: string; icon?: IconName; tone?: Tone }
export interface ShellSearchResult { id: string; title: string; subtitle?: string; group?: string; product?: string; icon?: IconName; tone?: Tone; /** true = contenitore (si apre a pagina intera), altrimenti elemento (pannello) */ container?: boolean; href?: string }
export interface ShellCrumb { label: string; href?: string; id?: string }
export type AccountAction = 'profile' | 'settings' | 'plan' | 'company' | 'logout';
export interface AppShellProps { active?: string; user?: string; email?: string; planName?: string;
  /** Solo testo, se non passi companies */ workspace?: string;
  /** Selettore «Azienda › workspace» */ companies?: ShellCompany[]; workspaceSlug?: string; onSelectWorkspace?: (slug: string, companyId: string) => void; onNewWorkspace?: (companyId?: string) => void;
  nav?: { group: string; items: (NavItem & { tone?: Exclude<Tone, 'neutral'>; home?: boolean })[]; products?: boolean }[]; /** id della voce del gruppo prodotti aperta: il gruppo diventa un menu collassabile in cima alla sidebar */ product?: string;
  actions?: React.ReactNode; onNavigate?: (id: string) => void; flush?: boolean; children?: React.ReactNode;
  /** Voci del menu «+» in cima alla sidebar (P-15): i tipi creabili nel modulo corrente. */ create?: MenuItem[];
  /** Ricerca Ctrl/Cmd+K: onSearch dal 2° carattere, dopo 300 ms */ onSearch?: (query: string) => void; searchResults?: ShellSearchResult[]; searchState?: 'ready' | 'loading' | 'error'; onSelectResult?: (r: ShellSearchResult) => void;
  /** Notifiche (P-07) */ notifications?: ShellNotification[]; unreadCount?: number; notificationsState?: 'ready' | 'loading' | 'error'; onNotificationsOpen?: () => void; onOpenNotification?: (n: ShellNotification) => void; onMarkAllRead?: () => void; onAllNotifications?: () => void; onRetryNotifications?: () => void;
  /** Menu del profilo: onAccount('logout') deve chiudere la sessione ovunque */ onAccount?: (id: AccountAction) => void; accountItems?: MenuItem[];
  /** Percorso Workspace › Cartella › Oggetto, ultima voce = pagina attuale */ crumbs?: ShellCrumb[]; onCrumb?: (c: ShellCrumb, index: number) => void;
  settingsHref?: string; labels?: AppShellLabels;
  /** Alias di labels.searchPlaceholder e labels.create, mantenuti per compatibilità: se presenti vincono su labels */ searchPlaceholder?: string; createLabel?: string }
/** Testi di default (italiano) dell'AppShell: base per le traduzioni passate in `labels`. */
export declare const APPSHELL_LABELS: Required<AppShellLabels>;
export declare function AppShell(props: AppShellProps): React.ReactElement;
/** Menu dei moduli di Zeiras, uguale in ogni schermata: Dashboard, Board, CRM, Bookings, Finanze; Report, Automazioni, Contenuti con «Presto». Usalo come primo gruppo di `nav`. */
export declare const MODULES_NAV: { group: string; products: true; items: (NavItem & { tone?: Exclude<Tone, 'neutral'>; home?: boolean })[] };

/** Testi fissi della card, tradotti dal consumer (default in italiano). */
export interface ProductTileLabels { active?: string; soon?: string; soonMeta?: string; open?: string }
export interface ProductTileProps { name: string; description?: string; icon?: IconName; tone?: Exclude<Tone, 'neutral'>; status?: 'active' | 'soon'; meta?: string; cta?: string; href?: string; onOpen?: () => void; labels?: ProductTileLabels }
export declare function ProductTile(props: ProductTileProps): React.ReactElement;

export interface BoardRef { name: string; cards?: number; href?: string }
export interface ProjectFolderProps { name: string; boards: BoardRef[]; tone?: Exclude<Tone, 'neutral'>; updated?: string; onOpenBoard?: (b: BoardRef) => void; onNewBoard?: () => void }
export declare function ProjectFolder(props: ProjectFolderProps): React.ReactElement;

export interface DashboardHomeProps { user?: string; greeting?: string; subtitle?: string; products?: (ProductTileProps & { id?: string })[]; folders?: ProjectFolderProps[]; onOpenProduct?: (p: ProductTileProps) => void; onNewBoard?: () => void }
export declare function DashboardHome(props: DashboardHomeProps): React.ReactElement;

export interface CardLabel { text: string; tone?: Tone }
export interface KanbanCardProps extends React.HTMLAttributes<HTMLElement> { title: string; labels?: CardLabel[]; due?: string; overdue?: boolean; checklist?: { done: number; total: number }; comments?: number; assignees?: string[]; cover?: Exclude<Tone, 'neutral'>; dragging?: boolean; draggable?: boolean }
export declare function KanbanCard(props: KanbanCardProps): React.ReactElement;

export interface KanbanColumnProps extends React.HTMLAttributes<HTMLElement> { title: string; count?: number; limit?: number; isOver?: boolean; onAdd?: () => void; composer?: React.ReactNode; children?: React.ReactNode }
export declare function KanbanColumn(props: KanbanColumnProps): React.ReactElement;

export interface KanbanList { id: string; title: string; limit?: number; cards: (KanbanCardProps & { id: string })[] }
export interface KanbanBoardProps { title?: string; product?: string; folder?: string; members?: string[]; lists?: KanbanList[]; onChange?: (lists: KanbanList[]) => void; onOpenCard?: (card: KanbanCardProps & { id: string }) => void; /** false nasconde il percorso interno: dentro AppShell il percorso lo mostra la cornice */ crumbs?: boolean }
export declare function KanbanBoard(props: KanbanBoardProps): React.ReactElement;


export interface MenuItem { icon?: IconName | string; label?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; hint?: string; sep?: boolean }
/** Menu contestuale ancorato a un pulsante (menu ⋯, menu «+» della sidebar, azioni rapide). Esc e clic fuori chiudono; frecce ↑ ↓ tra le voci. */
export declare function Menu(props: { anchor: HTMLElement | null; items: MenuItem[]; onClose: () => void; align?: 'start' | 'end'; label?: string; inline?: boolean; className?: string; /** blocco non interattivo in cima (es. nome ed email nel menu del profilo) */ head?: React.ReactNode }): React.ReactElement;
/** Compositore per la creazione in linea (P-15 F2): Invio crea e resta aperto, Maiusc+Invio va a capo (multiline), Esc annulla. */
export declare function Composer(props: { onCreate: (text: string) => void; onCancel?: () => void; placeholder?: string; label?: string; multiline?: boolean; rows?: number; submitLabel?: string; maxLength?: number; defaultValue?: string; autoFocus?: boolean; className?: string }): React.ReactElement;
/** Pannello di dettaglio a destra (P-15 F1): un record alla volta, senza velo; X ed Esc chiudono; su mobile tutto schermo con «Indietro». */
export declare function DetailPanel(props: { label: string; head?: React.ReactNode; children?: React.ReactNode; foot?: React.ReactNode; onClose: () => void; onBack?: () => void; backLabel?: string; inline?: boolean; className?: string }): React.ReactElement;

declare global { interface Window { Zeiras: { Logo: typeof Logo; Button: typeof Button; Label: typeof Label; Avatar: typeof Avatar; AvatarStack: typeof AvatarStack; Icon: typeof Icon; AppShell: typeof AppShell; DashboardHome: typeof DashboardHome; ProductTile: typeof ProductTile; ProjectFolder: typeof ProjectFolder; KanbanCard: typeof KanbanCard; KanbanColumn: typeof KanbanColumn; KanbanBoard: typeof KanbanBoard; SiteHeader: typeof SiteHeader; Hero: typeof Hero; SectionHeading: typeof SectionHeading; StepList: typeof StepList; AudienceGrid: typeof AudienceGrid; PricingCard: typeof PricingCard; FAQ: typeof FAQ; CtaBand: typeof CtaBand; SiteFooter: typeof SiteFooter; LandingPage: typeof LandingPage; LanguageSwitch: typeof LanguageSwitch; SectorGrid: typeof SectorGrid; Breadcrumb: typeof Breadcrumb; ICON_NAMES: typeof ICON_NAMES; Field: typeof Field; MentionField: typeof MentionField; MENTION_LABELS: typeof MENTION_LABELS; Checkbox: typeof Checkbox; Switch: typeof Switch; Tabs: typeof Tabs; Alert: typeof Alert; Toast: typeof Toast; Dialog: typeof Dialog; EmptyState: typeof EmptyState; Progress: typeof Progress; Skeleton: typeof Skeleton; PageHeader: typeof PageHeader; DataTable: typeof DataTable; FilterBar: typeof FilterBar; LineChart: typeof LineChart; BarChart: typeof BarChart; DonutChart: typeof DonutChart; Sparkline: typeof Sparkline; StatCard: typeof StatCard; ChartCard: typeof ChartCard; StatusLabel: typeof StatusLabel; RecordHeader: typeof RecordHeader; ActivityTimeline: typeof ActivityTimeline; DescriptionList: typeof DescriptionList; DealCard: typeof DealCard; DealPipeline: typeof DealPipeline; CrmContacts: typeof CrmContacts; ContactDetail: typeof ContactDetail; ReportDashboard: typeof ReportDashboard; AutomationStep: typeof AutomationStep; WorkflowBuilder: typeof WorkflowBuilder; AutomationList: typeof AutomationList; ContentStudio: typeof ContentStudio; DetailPanel: typeof DetailPanel; Composer: typeof Composer; Menu: typeof Menu; APPSHELL_LABELS: typeof APPSHELL_LABELS; APPSHELL_LABELS: Required<AppShellLabels>; MODULES_NAV: typeof MODULES_NAV; PUBLISHER: typeof PUBLISHER } } }

// ---------- Homepage ----------
export interface SiteLink { label: string; href: string }
/** Logo Zeiras: simbolo a tre blocchi + nome. `size` = altezza del simbolo (default 24, minimo 20); `wordmark: false` = solo simbolo. */
export declare function Logo(props?: { size?: number; wordmark?: boolean; className?: string }): React.ReactElement;
/** Una lingua del sito pubblico: link alla stessa pagina in quella lingua (hreflang). */
export interface SiteLanguage { code: string; label: string; href: string; current?: boolean }
export interface SiteHeaderLabels { login?: string; signup?: string; openMenu?: string; closeMenu?: string; nav?: string; home?: string; language?: string }
export declare function SiteHeader(props: { nav?: SiteLink[]; signupHref?: string; loginHref?: string; homeHref?: string; /** Selettore lingua compatto accanto ad «Accedi» */ languages?: SiteLanguage[]; labels?: SiteHeaderLabels }): React.ReactElement;
/** Selettore della lingua del sito pubblico: link veri (con hreflang e lang), mai un menu in JavaScript. `compact` in SiteHeader, `list` (default) in SiteFooter. */
export declare function LanguageSwitch(props: { languages?: SiteLanguage[]; variant?: 'list' | 'compact'; label?: string; className?: string }): React.ReactElement;
/** Percorso delle pagine pubbliche (BreadcrumbList): l'ultima voce è la pagina attuale, senza link. */
export declare function Breadcrumb(props: { items?: { label: string; href?: string }[]; label?: string; className?: string }): React.ReactElement;
export interface SectorItem { title: string; text?: string; icon?: IconName; tone?: Exclude<Tone, 'neutral' | 'coral'>; tags?: string[]; href?: string; cta?: string }
/** Griglia delle verticalizzazioni (VT-01): una card per settore che porta alla sua pagina /per/:settore. */
export declare function SectorGrid(props: { items?: SectorItem[]; cta?: string }): React.ReactElement;
export interface HeroPreview { title: string; lanes: { title: string; cards: KanbanCardProps[] }[] }
export interface HeroProps { kicker?: string; title?: string; subtitle?: string; cta?: string; secondaryCta?: string; note?: string; signupHref?: string; secondaryHref?: string; visual?: React.ReactNode; /** Contenuto dell'anteprima della board (titolo e liste), tradotto o di settore */ preview?: HeroPreview }
export declare function Hero(props: HeroProps): React.ReactElement;
export declare function SectionHeading(props: { overline?: string; title: string; subtitle?: string; align?: 'left' | 'center'; /** 1 = titolo della pagina (h1) nelle pagine senza Hero: prezzi, settori, blog */ level?: 1 | 2 }): React.ReactElement;
export declare function StepList(props: { steps?: { title: string; text: string }[] }): React.ReactElement;
export declare function AudienceGrid(props: { items?: { title: string; text: string }[] }): React.ReactElement;
export interface PricingCardProps { name: string; price: string; period?: string; description?: string; features?: string[]; badge?: string; featured?: boolean; status?: 'active' | 'soon'; cta?: string; href?: string; labels?: { soon?: string; soonCta?: string; cta?: string } }
export declare function PricingCard(props: PricingCardProps): React.ReactElement;
export declare function FAQ(props: { items?: { q: string; a: string }[] }): React.ReactElement;
export declare function CtaBand(props: { title?: string; subtitle?: string; cta?: string; href?: string }): React.ReactElement;
export interface Publisher { name: string; legalForm?: string; address?: string; vat?: string; taxCode?: string; rea?: string; capital?: string; pec?: string; email?: string; phone?: string }
export declare const PUBLISHER: Publisher;
export interface SiteFooterLabels { tagline?: string; by?: string; registeredOffice?: string; vat?: string; vatTax?: string; taxCode?: string; rea?: string; capital?: string; paidUp?: string; pec?: string; email?: string; phone?: string; rights?: string; legalNav?: string; missing?: string; language?: string; /** Etichetta delle voci senza link (default «In arrivo») */ soon?: string }
export declare function SiteFooter(props: { company?: Partial<Publisher>; /** Una voce senza `href` è testo senza link; con `soon: true` mostra «In arrivo» */ columns?: { title: string; links: (string | SiteLink | { label: string; href?: string; soon?: boolean })[] }[]; legalLinks?: { label: string; href?: string; onClick?: () => void; soon?: boolean }[]; onCookiePreferences?: () => void; tagline?: string; legal?: string; /** Selettore lingua sotto il marchio (P-14) */ languages?: SiteLanguage[]; labels?: SiteFooterLabels }): React.ReactElement;
export declare function LandingPage(props: { signupHref?: string; loginHref?: string; products?: (ProductTileProps & { id: string })[]; plans?: PricingCardProps[]; sectors?: SectorItem[] }): React.ReactElement;

// ---------- SaaS kit ----------
export declare const ICON_NAMES: IconName[];
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; as?: 'input' | 'textarea' | 'select'; options?: (string | { value: string; label: string })[]; icon?: IconName; rows?: number }
export declare function Field(props: FieldProps): React.ReactElement;
export interface MentionOption { id: string | number; name: string; email?: string; phone?: string; sub?: string; tag?: string; tagTone?: Tone }
export interface MentionLabels { remove?: string; create?: string; empty?: string; hint?: string; results?: string }
export declare const MENTION_LABELS: Required<MentionLabels>;
/** Scegliere clienti del CRM scrivendo @nome (P-16, CRM-01 F9). */
export declare function MentionField(props: { label?: string; suggestions?: MentionOption[]; value?: MentionOption[]; defaultValue?: MentionOption[]; onChange?: (v: MentionOption[]) => void; query?: string; defaultQuery?: string; onQuery?: (q: string | null) => void; open?: boolean; defaultOpen?: boolean; multiple?: boolean; maxResults?: number; onCreate?: (name: string) => void; createLabel?: string; hint?: string | false; error?: string; required?: boolean; placeholder?: string; labels?: MentionLabels; className?: string }): React.ReactElement;
export declare function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; indeterminate?: boolean }): React.ReactElement;
export declare function Switch(props: { label?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean; 'aria-label'?: string }): React.ReactElement;
export interface TabItem { value: string; label: string; icon?: IconName; count?: number }
export declare function Tabs(props: { items: (string | TabItem)[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; variant?: 'segmented' | 'underline'; size?: 'sm'; 'aria-label'?: string }): React.ReactElement;
export type StatusTone = 'info' | 'success' | 'warning' | 'danger';
export declare function Alert(props: { tone?: StatusTone; title?: string; children?: React.ReactNode; action?: React.ReactNode; onClose?: () => void }): React.ReactElement;
export declare function Toast(props: { tone?: StatusTone; children: React.ReactNode; actionLabel?: string; onAction?: () => void; onClose?: () => void }): React.ReactElement;
export declare function Dialog(props: { open: boolean; title: string; description?: string; onClose?: () => void; footer?: React.ReactNode; size?: 'md' | 'lg'; inline?: boolean; children?: React.ReactNode }): React.ReactElement | null;
export declare function EmptyState(props: { title: string; text?: string; icon?: IconName; tone?: Exclude<Tone, 'neutral'>; action?: React.ReactNode; compact?: boolean }): React.ReactElement;
export declare function Progress(props: { value: number; max?: number; label?: string; valueLabel?: string; tone?: 'pine' | 'warning' | 'danger' }): React.ReactElement;
export declare function Skeleton(props: { lines?: number }): React.ReactElement;
export declare function PageHeader(props: { title: string; overline?: string; subtitle?: string; count?: number; actions?: React.ReactNode }): React.ReactElement;
export interface Column<R> { key: string; label: string; align?: 'left' | 'right'; width?: string; sortable?: boolean; sortValue?: (r: R) => number | string; render?: (r: R) => React.ReactNode }
export declare function DataTable<R extends { id?: string | number }>(props: { columns: Column<R>[]; rows: R[]; selectable?: boolean; bulkActions?: React.ReactNode; pageSize?: number; defaultSort?: { key: string; dir: 'asc' | 'desc' }; onRowClick?: (r: R) => void; onSelect?: (ids: (string | number)[]) => void; empty?: React.ReactNode }): React.ReactElement;
export declare function FilterBar(props: { query?: string; onQuery?: (q: string) => void; searchPlaceholder?: string; search?: boolean; actions?: React.ReactNode; children?: React.ReactNode }): React.ReactElement;
export interface Series { name: string; data: number[]; color?: 1 | 2 | 3 | 4 | 5 | 'other'; dashed?: boolean }
export declare function LineChart(props: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; area?: boolean; ariaLabel?: string }): React.ReactElement;
export declare function BarChart(props: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; ariaLabel?: string }): React.ReactElement;
export declare function DonutChart(props: { data: { label: string; value: number; color?: Series['color'] }[]; format?: (v: number) => string; centerValue?: string; centerLabel?: string }): React.ReactElement;
export declare function Sparkline(props: { data: number[]; width?: number; height?: number; color?: Series['color'] }): React.ReactElement;
export declare function StatCard(props: { label: string; value: string; icon?: IconName; delta?: number; deltaLabel?: string; trend?: number[]; invert?: boolean }): React.ReactElement;
export declare function ChartCard(props: { title: string; subtitle?: string; actions?: React.ReactNode; children?: React.ReactNode }): React.ReactElement;
export declare function StatusLabel(props: { status: string; tone?: Tone }): React.ReactElement;
export declare function RecordHeader(props: { name: string; status?: string; subtitle?: string; meta?: { icon: IconName; text: string; href?: string }[]; actions?: React.ReactNode }): React.ReactElement;
export interface Activity { type: 'email' | 'call' | 'note' | 'deal' | 'task' | 'automation'; title: string; time: string; text?: string; by?: string }
export declare function ActivityTimeline(props: { items: Activity[] }): React.ReactElement;
/** Coppie etichetta → valore in sola lettura (campi di un record nel pannello di dettaglio, riepiloghi). `label` già tradotta; `value` testo o nodo (Label, link). Su schermi stretti l'etichetta resta a 110px a sinistra. */
export declare function DescriptionList(props: { items: { label: string; value: React.ReactNode }[] }): React.ReactElement;
export interface Deal { id: string; title: string; company: string; amount: number; owner?: string; probability?: number; age?: number }
/** Icona accanto a `company`: default 'building'; null la nasconde (es. quando il campo contiene una voce di catalogo o una persona). `ageLabel`/`ageTitle`: testi tradotti per i giorni in fase (default «gg», «Giorni in questa fase»). */
export declare function DealCard(props: Omit<Deal, 'id' | 'company'> & { company?: string; currency?: string; companyIcon?: IconName | null; ageLabel?: string; ageTitle?: string } & React.HTMLAttributes<HTMLElement> & { dragging?: boolean; draggable?: boolean }): React.ReactElement;
/** Testi della pipeline: vengono dal vocabolario della personalizzazione CRM (CRM-00) e dalle traduzioni; i default sono quelli del CRM «Generico» in italiano. */
export interface DealPipelineLabels { overline?: string; title?: string; open?: string; weighted?: string; filter?: string; newDeal?: string; total?: string; days?: string; daysTitle?: string }
/** Fase: `kind` 'won' | 'lost' esclude la colonna dai totali aperti e ponderati; 'won' ha fondo success-soft. Senza `kind` valgono gli id 'won' e 'lost'. */
export interface DealStage { id: string; title: string; kind?: 'open' | 'won' | 'lost'; deals: Deal[] }
/** `stages` è anche controllabile: se cambia dall'esterno (nuova trattativa, fase rinominata) la pipeline si riallinea. `onOpen(deal)` al clic o Invio su una card (apre il `DetailPanel`). `currency` (codice ISO, default EUR) per importi e totali. */
export declare function DealPipeline(props: { title?: string; stages?: DealStage[]; labels?: DealPipelineLabels; companyIcon?: IconName | null; currency?: string; onNew?: () => void; onFilter?: () => void; onChange?: (s: DealStage[]) => void; onOpen?: (deal: Deal) => void }): React.ReactElement;
export interface Contact { id: string; name: string; email: string; company: string; status: string; owner: string; value: number; last: string }
export declare function CrmContacts(props: { contacts?: Contact[]; onOpen?: (c: Contact) => void; pageSize?: number }): React.ReactElement;
export declare function ContactDetail(props: { contact?: { name: string; role: string; company: string; status: string; email: string; phone: string; owner: string }; activities?: Activity[] }): React.ReactElement;
export declare function ReportDashboard(props: { title?: string }): React.ReactElement;
export interface FlowStep { id: string; type: 'trigger' | 'condition' | 'action' | 'delay'; title: string; detail?: string; icon?: IconName; stats?: string }
export declare function AutomationStep(props: FlowStep & { selected?: boolean; onClick?: () => void }): React.ReactElement;
export declare function WorkflowBuilder(props: { name?: string; steps?: FlowStep[]; active?: boolean; defaultSelected?: string; onChange?: (s: FlowStep[]) => void }): React.ReactElement;
export declare function AutomationList(props: { automations?: { id: string | number; name: string; trigger: string; runs: number; last: string; status: 'Attiva' | 'In pausa' | 'Errore' }[]; onOpen?: (a: unknown) => void }): React.ReactElement;
export declare function ContentStudio(props: { onGenerate?: (form: { type: string; topic: string; audience: string; tone: string; length: string }) => Promise<{ id: string | number; text: string }[]>; onSave?: (v: { id: string | number; text: string }) => void; used?: number; limit?: number; autoGenerate?: boolean }): React.ReactElement;
