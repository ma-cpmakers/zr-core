import type * as React from 'react';

export type Tone = 'pine' | 'citrus' | 'coral' | 'sky' | 'plum' | 'neutral';
export type IconName = 'menu' | 'home' | 'grid' | 'folder' | 'board' | 'users' | 'megaphone' | 'search' | 'plus' | 'calendar' | 'checklist' | 'message' | 'bell' | 'settings' | 'more' | 'chevron' | 'arrow' | 'filter' | 'list' | 'clock' | 'close' | 'share' | 'chart' | 'bolt' | 'sparkle' | 'mail' | 'phone' | 'building' | 'euro' | 'trendUp' | 'trendDown' | 'download' | 'upload' | 'edit' | 'trash' | 'copy' | 'refresh' | 'play' | 'pause' | 'eye' | 'link' | 'tag' | 'star' | 'info' | 'alert' | 'checkCircle' | 'xCircle' | 'split' | 'user' | 'globe' | 'sort' | 'chevronDown' | 'chevronUp' | 'chevronLeft' | 'check' | 'file' | 'form' | 'target' | 'gantt' | 'archive';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: IconName; /** l'azione è partita e si aspetta: aria-busy, il fuoco resta, il clic non riparte */ busy?: boolean }
export declare function Button(props: ButtonProps): React.ReactElement;

export interface LabelProps { tone?: Tone; children?: React.ReactNode; className?: string; /** una frase lunga va a capo */ wrap?: boolean; /** la «×» che toglie l'etichetta; removeLabel il suo verbo (default «Togli» nella lingua dell'app, `COMMON_LABELS`), il nome è «Togli: <testo>» */ onRemove?: () => void; removeLabel?: string; /** l'etichetta proposta, a contorno tratteggiato con «+», che si aggiunge; addLabel il verbo (default «Aggiungi» nella lingua dell'app) */ onAdd?: () => void; addLabel?: string;
  /** "type": il tipo di una cosa (Storia, Bug…), a contorno col puntino del tono, da non confondere con le etichette scelte; senza, l'etichetta piena */ variant?: 'type' }
export declare function Label(props: LabelProps): React.ReactElement;

export interface AvatarProps { name: string; size?: 'sm' | 'md' | 'lg'; tone?: Exclude<Tone, 'neutral'>;
  /** Foto della persona: tonda, ritagliata a riempire; se manca o non si carica restano le iniziali */ src?: string;
  /** Il nome è già scritto accanto: l'avatar si nasconde al lettore di schermo (niente ruolo, nome né tooltip) */ decorative?: boolean }
export declare function Avatar(props: AvatarProps): React.ReactElement;
export interface AvatarStackProps { people: string[]; max?: number; size?: 'sm' | 'md' | 'lg' }
export declare function AvatarStack(props: AvatarStackProps): React.ReactElement;
export declare function Icon(props: { name: IconName; size?: number; className?: string }): React.ReactElement;
/** I marchi dei servizi esterni come li danno i proprietari (richiesta 199): coi loro colori, solo accanto al nome del servizio */
export type BrandIconName = 'google-calendar' | 'outlook';
/** decorativo (aria-hidden) senza title; con title è un'immagine col suo nome. Un nome che il set non ha non disegna niente */
export declare function BrandIcon(props: { name: BrandIconName; size?: number; title?: string; className?: string }): React.ReactElement | null;

export interface NavItem { id: string; label: string; icon: IconName; soon?: boolean; off?: boolean; count?: number; /** la frase intera col numero, «2 da leggere»: si sente al posto del numero */ countLabel?: string; href?: string }
export interface AppShellLabels { soon?: string; off?: string; settings?: string; planTitle?: string; planText?: string; nav?: string; openMenu?: string; closeMenu?: string; userFallback?: string; create?: string; workspaceSwitch?: string; newWorkspace?: string; workspaceSettings?: string; /** «Il mio spazio», «Come cliente», «Crea il tuo workspace» (zr-account) */ personal?: string; personalGroup?: string; firstWorkspace?: string; search?: string; searchPlaceholder?: string; searchHint?: string; searchSubmitHint?: string; searchPressEnter?: string; searchLoading?: string; searchEmpty?: string; searchEmptyText?: string; searchError?: string; searchResults?: string; /** quanti risultati, detto al lettore di schermo: «Risultati: {n}» */ searchCount?: string; notifications?: string; unread?: string; /** il singolare di unread, con una sola non letta */ unreadOne?: string; /** detto quando una notifica letta con un clic porta le non lette a zero */ unreadNone?: string; forMe?: string; all?: string; markAllRead?: string; seeAll?: string; notificationsEmpty?: string; notificationsEmptyText?: string; notificationsError?: string; retry?: string; loading?: string; account?: string; profile?: string; accountSettings?: string; plan?: string; company?: string; logout?: string; crumbs?: string; /** il nome dell'area che scorre (il main) */ mainContent?: string; /** il link che porta il fuoco al main, primo nel giro del Tab */ skipToContent?: string }
export interface ShellWorkspace { slug: string; name: string; tone?: Exclude<Tone, 'neutral'> }
export interface ShellCompany { id: string; name: string; workspaces: ShellWorkspace[] }
export interface ShellNotification { id: string; title: string; text?: string; time?: string; product?: string; unread?: boolean; /** false = compare solo in «Tutte» */ forMe?: boolean; actor?: string; icon?: IconName; tone?: Tone }
export interface ShellSearchResult { id: string; title: string; subtitle?: string; group?: string; product?: string; icon?: IconName; tone?: Tone; /** true = contenitore (si apre a pagina intera), altrimenti elemento (pannello) */ container?: boolean; href?: string }
export interface ShellCrumb { label: string; href?: string; id?: string }
export type AccountAction = 'profile' | 'settings' | 'plan' | 'company' | 'logout';
export interface AppShellProps { /** id della voce attiva; senza, o vuoto, la Dashboard; null nessuna */ active?: string | null; user?: string; email?: string; planName?: string;
  /** Solo testo, se non passi companies */ workspace?: string;
  /** Selettore «Azienda › workspace» */ companies?: ShellCompany[]; workspaceSlug?: string; onSelectWorkspace?: (slug: string, companyId: string) => void; onNewWorkspace?: (companyId?: string) => void; workspaceSettingsHref?: string; onWorkspaceSettings?: (e: React.MouseEvent, slug?: string, companyId?: string) => void;
  nav?: { group: string; items: (NavItem & { tone?: Exclude<Tone, 'neutral'>; home?: boolean })[]; products?: boolean }[]; /** id della voce del gruppo prodotti aperta: il gruppo diventa un menu collassabile in cima alla sidebar */ product?: string;
  actions?: React.ReactNode; onNavigate?: (id: string) => void; /** la navigazione dell'app: con questa un clic semplice su una voce della sidebar con href di questa origine non ricarica la pagina (dopo onNavigate); Ctrl, Cmd, Maiusc, Alt, il tasto centrale e un'altra origine restano del browser */ navigate?: (href: string) => void; flush?: boolean; children?: React.ReactNode;
  /** Voci del menu «+» in cima alla sidebar (P-15): i tipi creabili nel modulo corrente. */ create?: MenuItem[];
  /** Ricerca Ctrl/Cmd+K: onSearch dal 2° carattere, dopo 300 ms; con searchOn='submit' solo a Invio */ onSearch?: (query: string) => void; searchResults?: ShellSearchResult[]; searchState?: 'ready' | 'loading' | 'error'; onSelectResult?: (r: ShellSearchResult) => void;
  /** Notifiche (P-07) */ notifications?: ShellNotification[]; unreadCount?: number; notificationsState?: 'ready' | 'loading' | 'error'; onNotificationsOpen?: () => void; /** quando il pannello si chiude, da qualunque strada (pulsante, Esc, clic fuori, una notifica aperta, un altro menu): una chiamata a ogni chiusura */ onNotificationsClose?: () => void; onOpenNotification?: (n: ShellNotification) => void; onMarkAllRead?: () => void; onAllNotifications?: () => void; onRetryNotifications?: () => void; /** l'avviso letto ad alta voce («Segnate tutte come lette»): una zona viva che non si vede, sempre montata */ notificationsNotice?: string;
  /** Menu del profilo: onAccount('logout') deve chiudere la sessione ovunque */ onAccount?: (id: AccountAction) => void; accountItems?: MenuItem[];
  /** Percorso Workspace › Area › Oggetto, ultima voce = pagina attuale */ crumbs?: ShellCrumb[]; /** riceve anche l'evento del clic: con preventDefault la voce la gestisce chi lo chiama; altrimenti, con navigate, un clic semplice su un href di questa origine non ricarica la pagina */ onCrumb?: (c: ShellCrumb, index: number, event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** «Il mio spazio»: la persona come cliente di altre aziende su Zeiras (zr-account). In cima al selettore, nel gruppo «Come cliente»; con `active` il selettore mostra lo spazio invece di un workspace. Il selettore c'è anche senza `companies` (chi è solo cliente), con «Crea il tuo workspace» se c'è `onNewWorkspace`. */ personal?: { label?: string; active?: boolean; href?: string; onSelect?: (e: React.MouseEvent) => void };
  /** false toglie il riquadro «Piano Personale» in fondo alla sidebar (per esempio nello spazio cliente) */ plan?: boolean;
  settingsHref?: string; labels?: AppShellLabels;
  /** false toglie la voce in fondo alla sidebar (Impostazioni), anche nel cassetto */ settings?: boolean;
  /** false non mostra la ricerca: niente campo nella barra in alto né Ctrl/Cmd+K (per esempio nello spazio cliente, dove non c'è niente da cercare) */ search?: boolean;
  /** Foto della persona per l'avatar del menu del profilo (vedi Avatar.src) */ userPhoto?: string;
  /** 'type' (default): onSearch mentre si scrive; 'submit': onSearch solo a Invio */ searchOn?: 'type' | 'submit';
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
export interface KanbanCardProps extends React.HTMLAttributes<HTMLElement> { title: string; /** il numero della scheda, «#12» in grigio davanti al titolo */ number?: number | string; labels?: CardLabel[]; due?: string; overdue?: boolean; checklist?: { done: number; total: number }; comments?: number; assignees?: string[]; cover?: Exclude<Tone, 'neutral'>; dragging?: boolean; draggable?: boolean; /** i testi nella lingua del modulo, default KANBAN_TEXTS */ texts?: KanbanTexts; /** le azioni rapide del «⋯»: senza, il «⋯» non c'è */ actions?: MenuItem[]; /** il nome del «⋯», default texts.cardActions */ actionsLabel?: string; /** il voto anonimo (retrospettiva): quanti, se la persona ha votato, e onToggle per votare o togliere il voto; senza onToggle solo il numero */ votes?: { count: number; mine?: boolean; onToggle?: () => void } }
export declare function KanbanCard(props: KanbanCardProps): React.ReactElement;

export interface KanbanColumnProps extends React.HTMLAttributes<HTMLElement> { title: string; count?: number; limit?: number; isOver?: boolean; onAdd?: () => void; composer?: React.ReactNode; children?: React.ReactNode; texts?: KanbanTexts }
export declare function KanbanColumn(props: KanbanColumnProps): React.ReactElement;

export interface KanbanList { id: string; title: string; limit?: number; cards: (KanbanCardProps & { id: string })[] }
/** I testi della board: {date}, {n} e {title} si sostituiscono */
export interface KanbanTexts { overdue?: string; checklist?: string; comments?: string; wipLimit?: string; overLimit?: string; listActions?: string; addCard?: string; addList?: string; newList?: string; cardTitle?: string; cardTitleLabel?: string; /** default «Aggiungi» e «Annulla» nella lingua dell'app (`LabelsProvider`) */ add?: string; cancel?: string; cardActions?: string; /** il voto: «Vota», «{n} voti», «1 voto», «hai votato» */ vote?: string; votes?: string; oneVote?: string; voted?: string; /** il title del pulsante quando la persona ha già votato, default «Togli il voto» */ unvote?: string; crumbs?: string; board?: string; list?: string; calendar?: string; filter?: string; share?: string }
export declare const KANBAN_TEXTS: Required<KanbanTexts>;
export declare function AddList(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }): React.ReactElement;
export interface KanbanBoardProps { texts?: KanbanTexts; closeLabel?: string; title?: string; product?: string; folder?: string; members?: string[]; lists?: KanbanList[]; onChange?: (lists: KanbanList[]) => void; onOpenCard?: (card: KanbanCardProps & { id: string }) => void; /** false nasconde il percorso interno: dentro AppShell il percorso lo mostra la cornice */ crumbs?: boolean }
export declare function KanbanBoard(props: KanbanBoardProps): React.ReactElement;


export interface MenuItem { icon?: IconName | string; label?: string; onClick?: () => void; danger?: boolean; disabled?: boolean; /** con disabled: perché non si può, sotto la voce; la voce resta raggiungibile con le frecce */ reason?: string; hint?: string; sep?: boolean; /** una scelta fra più (la pipeline attiva): menuitemradio con aria-checked e il segno sulla scelta */ checked?: boolean }
/** Menu contestuale ancorato a un pulsante (menu ⋯, menu «+» della sidebar, azioni rapide). Esc e clic fuori chiudono; frecce ↑ ↓ tra le voci. Sotto il pulsante se ci sta, sopra se ci sta, altrimenti dal lato con più spazio, con lo scroll. */
export declare function Menu(props: { anchor: HTMLElement | null; items: MenuItem[]; onClose: () => void; align?: 'start' | 'end'; label?: string; inline?: boolean; className?: string; /** blocco non interattivo in cima (es. nome ed email nel menu del profilo) */ head?: React.ReactNode; /** dove torna il fuoco con Esc e con la scelta di una voce (la scheda delle azioni rapide); senza, o fuori dalla pagina, il pulsante */ returnFocus?: HTMLElement | null | React.RefObject<HTMLElement | null> }): React.ReactElement;
/** Compositore per la creazione in linea (P-15 F2): Invio crea e resta aperto, Maiusc+Invio va a capo (multiline), Esc annulla. */
export declare function Composer(props: { /** false, o una Promise rifiutata o risolta a false: la creazione non è riuscita e il testo resta */ onCreate: (text: string) => void | boolean | Promise<boolean | void>; /** l'errore sotto il campo, legato e annunciato */ error?: React.ReactNode; onCancel?: () => void; /** nome della ✕, default «Annulla» nella lingua dell'app */ closeLabel?: string; placeholder?: string; label?: string; multiline?: boolean; rows?: number; /** default «Aggiungi» nella lingua dell'app */ submitLabel?: string; maxLength?: number; defaultValue?: string; autoFocus?: boolean; className?: string }): React.ReactElement;
/** Pannello di dettaglio a destra (P-15 F1): un record alla volta, senza velo; X ed Esc chiudono; su mobile tutto schermo con «Indietro». */
export declare function DetailPanel(props: { label: string; head?: React.ReactNode; children?: React.ReactNode; foot?: React.ReactNode; /** le azioni del pannello (per esempio il «⋯» «Altre azioni»), a destra prima della ✕; restano anche sotto 720 px (richiesta 191) */ actions?: React.ReactNode; onClose: () => void; onBack?: () => void; /** default «Indietro» nella lingua dell'app */ backLabel?: string; inline?: boolean; className?: string;
  /** Nome della ✕, default «Chiudi» nella lingua dell'app (`LabelsProvider`) */ closeLabel?: string;
  /** true: aria-modal e Tab trattenuto; se manca, modale solo quando copre la pagina (sotto 720 px, non inline) */ modal?: boolean;
  /** Il controllo a cui torna il fuoco alla chiusura, se c'è ancora (altrimenti chi ha aperto il pannello) */ returnFocus?: HTMLElement | null | React.RefObject<HTMLElement | null> }): React.ReactElement;

declare global { interface Window { Zeiras: { Logo: typeof Logo; Button: typeof Button; Label: typeof Label; Avatar: typeof Avatar; AvatarStack: typeof AvatarStack; Icon: typeof Icon; AppShell: typeof AppShell; DashboardHome: typeof DashboardHome; ProductTile: typeof ProductTile; ProjectFolder: typeof ProjectFolder; KanbanCard: typeof KanbanCard; KanbanColumn: typeof KanbanColumn; KanbanBoard: typeof KanbanBoard; AddList: typeof AddList; KANBAN_TEXTS: typeof KANBAN_TEXTS; SiteHeader: typeof SiteHeader; Hero: typeof Hero; SectionHeading: typeof SectionHeading; StepList: typeof StepList; AudienceGrid: typeof AudienceGrid; PricingCard: typeof PricingCard; FAQ: typeof FAQ; CtaBand: typeof CtaBand; SiteFooter: typeof SiteFooter; LandingPage: typeof LandingPage; LanguageSwitch: typeof LanguageSwitch; SectorGrid: typeof SectorGrid; Breadcrumb: typeof Breadcrumb; ICON_NAMES: typeof ICON_NAMES; BrandIcon: typeof BrandIcon; BRAND_ICON_NAMES: typeof BRAND_ICON_NAMES; Field: typeof Field; MentionField: typeof MentionField; MENTION_LABELS: typeof MENTION_LABELS; AddressField: typeof AddressField; ADDRESS_LABELS: typeof ADDRESS_LABELS; Checkbox: typeof Checkbox; RadioGroup: typeof RadioGroup; ColorPicker: typeof ColorPicker; COLOR_NAMES: typeof COLOR_NAMES; ToggleGroup: typeof ToggleGroup; InlineEdit: typeof InlineEdit; INLINE_EDIT_LABELS: typeof INLINE_EDIT_LABELS; Calendar: typeof Calendar; CALENDAR_LABELS: typeof CALENDAR_LABELS; AgendaGrid: typeof AgendaGrid; AGENDA_LABELS: typeof AGENDA_LABELS; Switch: typeof Switch; Tabs: typeof Tabs; Alert: typeof Alert; Toast: typeof Toast; Dialog: typeof Dialog; EmptyState: typeof EmptyState; Progress: typeof Progress; Skeleton: typeof Skeleton; PageHeader: typeof PageHeader; DataTable: typeof DataTable; DATATABLE_LABELS: typeof DATATABLE_LABELS; ReorderList: typeof ReorderList; REORDER_LABELS: typeof REORDER_LABELS; FilterBar: typeof FilterBar; LineChart: typeof LineChart; BarChart: typeof BarChart; DonutChart: typeof DonutChart; Sparkline: typeof Sparkline; StatCard: typeof StatCard; ChartCard: typeof ChartCard; SectionCard: typeof SectionCard; StatusLabel: typeof StatusLabel; RecordHeader: typeof RecordHeader; ActivityTimeline: typeof ActivityTimeline; DescriptionList: typeof DescriptionList; DealCard: typeof DealCard; DealPipeline: typeof DealPipeline; CrmContacts: typeof CrmContacts; ContactDetail: typeof ContactDetail; ReportDashboard: typeof ReportDashboard; AutomationStep: typeof AutomationStep; WorkflowBuilder: typeof WorkflowBuilder; AutomationList: typeof AutomationList; ContentStudio: typeof ContentStudio; DetailPanel: typeof DetailPanel; Composer: typeof Composer; Menu: typeof Menu; NotificationItem: typeof NotificationItem; LabelsProvider: typeof LabelsProvider; useLabels: typeof useLabels; COMMON_LABELS: typeof COMMON_LABELS; APPSHELL_LABELS: typeof APPSHELL_LABELS; MODULES_NAV: typeof MODULES_NAV; PUBLISHER: typeof PUBLISHER } } }

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
export interface Publisher { name: string; legalForm?: string; address?: string; vat?: string; taxCode?: string; /** il n. REA: si mostra solo se c'è, senza segnaposto */ rea?: string; capital?: string; pec?: string; email?: string; phone?: string }
export declare const PUBLISHER: Publisher;
export interface SiteFooterLabels { tagline?: string; by?: string; registeredOffice?: string; vat?: string; vatTax?: string; taxCode?: string; rea?: string; capital?: string; paidUp?: string; pec?: string; email?: string; phone?: string; rights?: string; legalNav?: string; missing?: string; language?: string; /** Etichetta delle voci senza link (default «In arrivo») */ soon?: string }
export declare function SiteFooter(props: { company?: Partial<Publisher>; /** Una voce senza `href` è testo senza link; con `soon: true` mostra «In arrivo» */ columns?: { title: string; links: (string | SiteLink | { label: string; href?: string; soon?: boolean })[] }[]; legalLinks?: { label: string; href?: string; onClick?: () => void; soon?: boolean }[]; onCookiePreferences?: () => void; tagline?: string; legal?: string; /** Selettore lingua sotto il marchio (P-14) */ languages?: SiteLanguage[]; labels?: SiteFooterLabels }): React.ReactElement;
export declare function LandingPage(props: { signupHref?: string; loginHref?: string; products?: (ProductTileProps & { id: string })[]; plans?: PricingCardProps[]; sectors?: SectorItem[] }): React.ReactElement;

// ---------- SaaS kit ----------
export declare const ICON_NAMES: IconName[];
export declare const BRAND_ICON_NAMES: BrandIconName[];
export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; hint?: string; error?: string; as?: 'input' | 'textarea' | 'select'; options?: (string | { value: string; label: string })[]; icon?: IconName; rows?: number; /** quanti caratteri su quanti, per code point come il server, da from in su; full è l'annuncio al limite, «{max}» si sostituisce */ counter?: { max: number; from?: number; full?: string } }
export declare function Field(props: FieldProps): React.ReactElement;
export interface MentionOption { id: string | number; name: string; email?: string; phone?: string; sub?: string; tag?: string; tagTone?: Tone }
export interface MentionLabels { remove?: string; create?: string; empty?: string; hint?: string; results?: string }
export declare const MENTION_LABELS: Required<MentionLabels>;
/** Scegliere clienti del CRM scrivendo @nome (P-16, CRM-01 F9). */
export declare function MentionField(props: { label?: string; suggestions?: MentionOption[]; value?: MentionOption[]; defaultValue?: MentionOption[]; onChange?: (v: MentionOption[]) => void; query?: string; defaultQuery?: string; onQuery?: (q: string | null) => void; open?: boolean; defaultOpen?: boolean; multiple?: boolean; maxResults?: number; filter?: boolean; onCreate?: (name: string) => void; createLabel?: string; hint?: string | false; error?: string; required?: boolean; placeholder?: string; labels?: MentionLabels; className?: string }): React.ReactElement;
export interface AddressSuggestion { id: string; main: string; secondary?: string; kind?: 'citta' | 'indirizzo'; placeId?: string }
export interface AddressPlace extends AddressSuggestion { label: string }
export interface AddressLabels { results?: string; empty?: string; hint?: string; attribution?: string; city?: string; address?: string; freeText?: string; clear?: string }
export declare const ADDRESS_LABELS: Required<AddressLabels>;
export declare function AddressField(props: { label?: string; value?: string; defaultValue?: string; onChange?: (text: string) => void; onQuery?: (q: string) => void; suggestions?: AddressSuggestion[]; place?: AddressPlace | null; defaultPlace?: AddressPlace | null; onSelect?: (place: AddressPlace | null) => void; open?: boolean; defaultOpen?: boolean; minChars?: number; maxResults?: number; attribution?: boolean; hint?: string; error?: string; required?: boolean; placeholder?: string; labels?: AddressLabels; className?: string }): React.ReactElement;
export declare function Checkbox(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; indeterminate?: boolean;
  /** Testo d'aiuto sotto l'etichetta, legato con aria-describedby */ hint?: React.ReactNode;
  /** Messaggio d'errore sotto (prende il posto dell'aiuto, come in Field): bordo danger e aria-invalid */ error?: React.ReactNode }): React.ReactElement;
export declare function Switch(props: { label?: string; checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void; disabled?: boolean; 'aria-label'?: string;
  /** Spento ma raggiungibile col Tab: non cambia e non chiama onChange, stesso stile di disabled */ 'aria-disabled'?: boolean | 'true' | 'false';
  /** Il testo d'aiuto o d'errore sotto, per id (richiesta 179) */ 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' }): React.ReactElement;
export interface TabItem { value: string; label: string; icon?: IconName; count?: number; /** la frase intera col numero, «2 da leggere»: si sente al posto del numero */ countLabel?: string; /** l'id del pannello che la linguetta mostra (aria-controls) */ panelId?: string }
export declare function Tabs(props: { items: (string | TabItem)[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; variant?: 'segmented' | 'underline'; size?: 'sm'; 'aria-label'?: string }): React.ReactElement;
export interface ChoiceOption { value: string; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean }
/** Una scelta fra poche opzioni, tutte in vista: radio nativi in un fieldset (richiesta 89) */
export declare function RadioGroup(props: { options: (string | ChoiceOption)[]; value?: string | null; defaultValue?: string | null; onChange?: (v: string) => void; label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; required?: boolean; orientation?: 'vertical' | 'horizontal'; name?: string; disabled?: boolean; 'aria-label'?: string; id?: string; className?: string;
  /** "card": ogni scelta un riquadro col titolo (label) e la descrizione (hint); orientation non vale; senza, il pallino */ variant?: 'card';
  /** Con variant="card": "grid" mette due riquadri per riga da 480 px in su */ layout?: 'list' | 'grid' }): React.ReactElement;
/** Il colore di un'opzione o di un workspace, fra i toni (richiesta 104): null = nessun colore */
export declare const COLOR_NAMES: Record<Tone, string>;
export declare function ColorPicker(props: { label?: React.ReactNode; 'aria-label'?: string; value?: Tone | null; defaultValue?: Tone | null; onChange?: (v: Tone | null) => void; /** i toni da offrire, default i cinque senza neutral */ tones?: Tone[]; /** i nomi dei colori nella lingua del modulo, default COLOR_NAMES (italiano) */ names?: Partial<Record<Tone, string>>; /** il nome della scelta «nessun colore»: senza, la scelta non c'è */ none?: string; hint?: React.ReactNode; error?: React.ReactNode; name?: string; disabled?: boolean; id?: string; className?: string }): React.ReactElement;
export interface ToggleOption { value: string; label: React.ReactNode; icon?: IconName; count?: number | string; /** la frase intera col numero, «2 da leggere»: si sente al posto del numero */ countLabel?: string; disabled?: boolean; 'aria-label'?: string }
/** Scelte a pulsanti con lo stato premuto (aria-pressed), una o più (richiesta 141) */
export declare function ToggleGroup(props: { options: (string | ToggleOption)[]; multiple?: boolean;
  /** Una scelta: string | null; con multiple: string[] */ value?: string | null | string[]; defaultValue?: string | null | string[]; onChange?: (v: string | null | string[]) => void;
  /** A scelta singola, ripremere la scelta la toglie (onChange(null)) */ allowEmpty?: boolean;
  label?: React.ReactNode; 'aria-label'?: string; hint?: React.ReactNode; error?: React.ReactNode; size?: 'sm' | 'md'; layout?: 'wrap' | 'grid'; disabled?: boolean; id?: string; className?: string }): React.ReactElement;
export interface InlineEditLabels { edit?: string; empty?: string; saving?: string; saved?: string; error?: string; required?: string; keys?: string; keysMultiline?: string; /** un numero, una data o un'email che il browser non accetta */ invalid?: string }
export declare const INLINE_EDIT_LABELS: Required<InlineEditLabels>;
/** Un valore che si modifica dove sta: pulsante in vista, campo al clic, «Salvataggio…», «Salvato» o l'errore (richiesta 142) */
export declare function InlineEdit(props: { label: string; value: string | null | undefined;
  /** Se la Promise è rifiutata con un Error, il suo message è l'errore mostrato */ onSave?: (v: string) => void | Promise<unknown>;
  placeholder?: string; multiline?: boolean; rows?: number;
  /** Il tipo del campo (la tastiera giusta al tocco); non con multiline (richiesta 184) */ type?: 'text' | 'email' | 'tel' | 'url' | 'number' | 'date';
  /** "select": la scelta fra options, che salva appena scelta; in vista il nome dell'opzione (richiesta 184) */ as?: 'input' | 'select'; options?: (string | { value: string; label: string; disabled?: boolean })[];
  /** Come si vede un valore in vista (una data nel formato del modulo); il campo ha il valore com'è */ format?: (v: string) => string;
  required?: boolean; validate?: (v: string) => string | null | undefined; maxLength?: number; trim?: boolean; size?: 'body' | 'title'; disabled?: boolean;
  /** Si apre già in modifica, senza prendere il fuoco (con autoFocus lo prende) */ defaultEditing?: boolean; autoFocus?: boolean;
  /** Aperto o chiuso da chi usa il componente (per esempio da «Rinomina» in un menu): con editing serve onEditingChange */ editing?: boolean; onEditingChange?: (editing: boolean) => void;
  /** Il valore vuoto (o di soli spazi) annulla: niente salvataggio, niente errore, torna il valore di prima */ cancelOnEmpty?: boolean;
  /** Come si vede un valore non vuoto dentro il pulsante della vista (un nome di link, un'icona e il testo); niente di cliccabile: il nome accessibile resta il testo (richiesta 192) */ view?: (v: string) => React.ReactNode;
  /** Accanto alla vista, fuori dal clic che apre il campo: un link, «Chiama»; in modifica non si vede (richiesta 192) */ actions?: React.ReactNode;
  /** Smontato col campo aperto (la ✕ del pannello, un altro contatto), la bozza cambiata e valida si salva con onSave, una volta; non dopo un errore (richiesta 193) */ saveOnUnmount?: boolean;
  labels?: InlineEditLabels; className?: string }): React.ReactElement;
export interface CalendarEvent { id?: string | number; date: string; label: string; tone?: Tone }
export interface CalendarLabels { prevMonth?: string; nextMonth?: string; prevWeek?: string; nextWeek?: string; marked?: string; events?: (n: number) => string; more?: (n: number) => string }
export declare const CALENDAR_LABELS: Required<CalendarLabels>;
/** Il calendario: scegliere un giorno, il mese con gli eventi, la settimana in una riga (richiesta 140). Giorni come 'AAAA-MM-GG' */
export interface AgendaEvent { id?: string | number; /** «HH:MM», 24 ore, nel fuso della pagina; la fine può essere «24:00» */ start: string; end: string; title: string; /** la seconda riga; senza, l'orario */ subtitle?: string; tone?: Tone;
  /** soft: fondo -soft e bordo del tono (default); outline: fondo bianco e bordo del tono; solid: il tono pieno (pine, citrus, coral) */ variant?: 'soft' | 'outline' | 'solid';
  /** false: non si clicca anche con onEventClick */ clickable?: boolean; /** un impegno d'altrove: grigio, senza clic, non allarga le ore e si ritaglia */ passive?: boolean; /** il nome per il lettore di schermo, al posto di «titolo, riga, orario» */ label?: string }
export interface AgendaAllDayItem { id?: string | number; title: string; tone?: Tone; variant?: 'soft' | 'outline' | 'solid'; clickable?: boolean; label?: string }
export interface AgendaDay { /** AAAA-MM-GG */ date: string; events?: AgendaEvent[]; allDay?: AgendaAllDayItem[] }
export interface AgendaSelection { date: string; start: string; end: string }
export interface AgendaLabels { instructions?: string; allDay?: string; /** «{day}, {time}»: detto quando il segno della tastiera si muove */ marker?: string }
export declare const AGENDA_LABELS: Required<AgendaLabels>;
/** La griglia di un'agenda con le ore: un giorno per colonna, gli eventi alti quanto durano, la scelta di un intervallo trascinando, toccando o da tastiera (richiesta 202) */
export declare function AgendaGrid(props: { days: AgendaDay[]; today?: string; locale?: string; /** le ore mostrate, 8 e 19 di default; un evento fuori le allarga */ startHour?: number; endHour?: number; hourHeight?: number; /** i minuti del trascinamento e delle frecce, 15 di default */ step?: number;
  /** trascinando, toccando (un'ora) o con Invio; senza, la griglia non si sceglie */ onSelect?: (s: AgendaSelection) => void; /** l'intervallo scelto, mostrato sopra gli eventi */ selection?: AgendaSelection | null;
  onEventClick?: (e: AgendaEvent | AgendaAllDayItem, date: string) => void; labels?: AgendaLabels; 'aria-label'?: string; className?: string }): React.ReactElement;
export declare function Calendar(props: { variant?: 'picker' | 'month' | 'week'; value?: string | null; defaultValue?: string | null; onChange?: (giorno: string) => void;
  /** 'AAAA-MM' */ defaultMonth?: string; onRangeChange?: (r: { from: string; to: string }) => void; min?: string; max?: string; isDisabled?: (giorno: string) => boolean; marked?: string[];
  events?: CalendarEvent[]; maxEvents?: number; onEventClick?: (e: CalendarEvent) => void; onMore?: (giorno: string) => void; locale?: string; weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6; today?: string; labels?: CalendarLabels; className?: string }): React.ReactElement;
export type StatusTone = 'info' | 'success' | 'warning' | 'danger';
export declare function Alert(props: { tone?: StatusTone; title?: string; children?: React.ReactNode; action?: React.ReactNode; onClose?: () => void; /** Nome della ✕ per il lettore di schermo (default «Chiudi» nella lingua dell'app, `LabelsProvider`) */ closeLabel?: string }): React.ReactElement;
export declare function Toast(props: { tone?: StatusTone; children: React.ReactNode; actionLabel?: string; onAction?: () => void; onClose?: () => void; /** Nome della ✕, default «Chiudi» nella lingua dell'app (`LabelsProvider`) */ closeLabel?: string }): React.ReactElement;
export declare function Dialog(props: { open: boolean; title: string; description?: string; onClose?: () => void; footer?: React.ReactNode; /** sm = una domanda sì/no: resta piccola e al centro anche sotto 720 px */ size?: 'sm' | 'md' | 'lg'; inline?: boolean; children?: React.ReactNode; /** Nome della ✕, default «Chiudi» nella lingua dell'app (`LabelsProvider`) */ closeLabel?: string }): React.ReactElement | null;
export declare function EmptyState(props: { title: string; text?: string; icon?: IconName; tone?: Exclude<Tone, 'neutral'>; action?: React.ReactNode; compact?: boolean }): React.ReactElement;
export declare function Progress(props: { value: number; max?: number; label?: string; valueLabel?: string; tone?: 'pine' | 'warning' | 'danger' }): React.ReactElement;
export declare function Skeleton(props: { lines?: number }): React.ReactElement;
export declare function PageHeader(props: { title: string; overline?: string; subtitle?: string; count?: number; /** la frase intera col numero, «2 da leggere»: si sente al posto del numero */ countLabel?: string; actions?: React.ReactNode }): React.ReactElement;
export interface Column<R> { key: string; label: string; /** il nome di una colonna senza titolo visibile (label ''), per il lettore di schermo e sulle schede sotto 720 px */ srLabel?: string; align?: 'left' | 'right'; width?: string; /** la larghezza sotto la quale la colonna non scende: le altre scorrono di lato */ minWidth?: string; sortable?: boolean; sortValue?: (r: R) => number | string; render?: (r: R) => React.ReactNode }
export interface DataTableLabels { selected?: string; /** con una riga sola: «{n} selezionato» */ selectedOne?: string; deselect?: string; selectAll?: string; selectRow?: string; /** con rowName: «Seleziona {name}» */ selectRowName?: string; range?: string; prev?: string; next?: string; emptyTitle?: string; emptyText?: string; sortBy?: string; sortNone?: string; ascending?: string; descending?: string; more?: string }
export declare const DATATABLE_LABELS: Required<DataTableLabels>;
export declare function DataTable<R extends { id?: string | number }>(props: { columns: Column<R>[]; rows: R[]; selectable?: boolean; bulkActions?: React.ReactNode; pageSize?: number; defaultSort?: { key: string; dir: 'asc' | 'desc' }; /** l'ordine tenuto dalla pagina: le righe si mostrano come arrivano (già ordinate dal server) e il clic chiama onSort */ sort?: { key: string; dir: 'asc' | 'desc' } | null; onSort?: (sort: { key: string; dir: 'asc' | 'desc' } | null) => void; /** la selezione tenuta dalla pagina; onSelect dice quella nuova */ selected?: (string | number)[]; /** il nome della riga nella casella: «Seleziona <nome>» per il lettore di schermo */ rowName?: (r: R) => string | null | undefined; /** caselle, «Seleziona tutti» e «Deseleziona» spenti durante un'operazione sulle righe scelte */ selectionDisabled?: boolean; onRowClick?: (r: R) => void; onSelect?: (ids: (string | number)[]) => void; /** le righe a blocchi: tutte quelle arrivate, «1–20 di total» e «Mostra altri» finché ne mancano, al posto delle pagine */ onMore?: () => void; total?: number; loadingMore?: boolean; /** la prima colonna (e la casella) resta ferma quando la tabella scorre di lato */ stickyFirst?: boolean; empty?: React.ReactNode; labels?: DataTableLabels; locale?: string }): React.ReactElement;
export interface ReorderItem { id: string | number; label: React.ReactNode; description?: React.ReactNode }
/** «{item}: posizione {n} di {total}»: detto al lettore di schermo dopo uno spostamento */
export interface ReorderLabels { up?: string; down?: string; moved?: string }
export declare const REORDER_LABELS: Required<ReorderLabels>;
/** un elenco che si riordina trascinando la maniglia, o con «Sposta su» e «Sposta giù» (richiesta 25); onChange dà l'elenco nel nuovo ordine */
export declare function ReorderList<T extends ReorderItem>(props: { items: T[]; onChange: (items: T[]) => void; render?: (item: T) => React.ReactNode; labels?: ReorderLabels; 'aria-label'?: string; className?: string }): React.ReactElement;
export declare function FilterBar(props: { /** sotto 720 px i filtri in una riga sola che scorre */ compact?: boolean; query?: string; onQuery?: (q: string) => void; searchPlaceholder?: string; search?: boolean; actions?: React.ReactNode; children?: React.ReactNode;
  /** Nome del campo di ricerca per il lettore di schermo, nella lingua del modulo (default «Cerca») */ searchLabel?: string;
  /** Frase d'aiuto sotto il campo, legata con aria-describedby (cosa si può cercare) */ searchHint?: React.ReactNode }): React.ReactElement;
export interface Series { name: string; data: number[]; color?: 1 | 2 | 3 | 4 | 5 | 'other'; dashed?: boolean;
  /** A gradino: orizzontale fino al punto dopo, poi il salto in verticale (vince su LineChart.step) */ step?: boolean }
export declare function LineChart(props: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; area?: boolean; ariaLabel?: string;
  /** Tutte le serie a gradino (una serie può dire il contrario con Series.step) */ step?: boolean }): React.ReactElement;
export declare function BarChart(props: { labels: string[]; series: Series[]; height?: number; format?: (v: number) => string; ariaLabel?: string }): React.ReactElement;
export declare function DonutChart(props: { data: { label: string; value: number; color?: Series['color'] }[]; format?: (v: number) => string; centerValue?: string; centerLabel?: string }): React.ReactElement;
export declare function Sparkline(props: { data: number[]; width?: number; height?: number; color?: Series['color'] }): React.ReactElement;
export declare function StatCard(props: { label: string; value: string; icon?: IconName; delta?: number; deltaLabel?: string; trend?: number[]; invert?: boolean }): React.ReactElement;
/** Riquadro di sezione di una pagina: titolo (heading-2) e azioni a destra, contenuto qualsiasi; 'standalone' per un riquadro da solo, come il modulo d'ingresso */
export declare function SectionCard(props: { title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; footer?: React.ReactNode; more?: { label: string; href?: string; onClick?: (e: React.MouseEvent) => void }; children?: React.ReactNode; variant?: 'section' | 'standalone'; headingLevel?: 2 | 3; id?: string; className?: string; 'aria-label'?: string }): React.ReactElement;
export declare function ChartCard(props: { title: string; subtitle?: string; actions?: React.ReactNode; children?: React.ReactNode;
  /** Il livello del titolo (richiesta 180): 3 o 4 dentro una sezione che ha già il suo h2; l'aspetto non cambia */ headingLevel?: 2 | 3 | 4 }): React.ReactElement;
export declare function StatusLabel(props: { status: string; tone?: Tone }): React.ReactElement;
export declare function RecordHeader(props: { name: string; status?: string; /** Il tono dello stato, come tone di StatusLabel nelle liste */ statusTone?: Tone; subtitle?: string; meta?: { icon: IconName; text: string; href?: string }[]; actions?: React.ReactNode }): React.ReactElement;
export interface ActivityAction { label: string; onClick?: () => void; icon?: IconName; tone?: 'danger'; disabled?: boolean }
export interface Activity { id?: string | number; type: 'email' | 'call' | 'meeting' | 'message' | 'note' | 'deal' | 'task' | 'automation'; title: string; time: string; text?: string; by?: string; outcome?: string; outcomeTone?: Tone; actions?: ActivityAction[]; edit?: React.ReactNode }
export declare function ActivityTimeline(props: { items: Activity[] }): React.ReactElement;
/** Coppie etichetta → valore in sola lettura (campi di un record nel pannello di dettaglio, riepiloghi). `label` già tradotta; `value` testo o nodo (Label, link). Su schermi stretti l'etichetta resta a 110px a sinistra. */
export declare function DescriptionList(props: { items: { label: string; value: React.ReactNode }[] }): React.ReactElement;
export interface Deal { id: string; title: string; company: string; amount: number; /** l'importo già scritto dal modulo (valuta e lingua): si mostra al posto di quello formattato in it-IT; `amount` resta per totali e ponderati */ amountText?: string; owner?: string; probability?: number; age?: number }
/** Icona accanto a `company`: default 'building'; null la nasconde (es. quando il campo contiene una voce di catalogo o una persona). `ageLabel`/`ageTitle`: testi tradotti per i giorni in fase (default «gg», «Giorni in questa fase»). */
export declare function DealCard(props: Omit<Deal, 'id' | 'company'> & { company?: string; currency?: string; /** scrive l'importo quando manca `amountText`, nella valuta e lingua del modulo (richiesta 190) */ formatAmount?: (value: number) => string; companyIcon?: IconName | null; ageLabel?: string; ageTitle?: string } & React.HTMLAttributes<HTMLElement> & { dragging?: boolean; draggable?: boolean; /** il «⋯» delle azioni (come KanbanCard): senza, non c'è */ actions?: MenuItem[]; actionsLabel?: string; /** lo spostamento aspetta il modulo: aria-busy, il cerchio d'attesa, non si trascina */ busy?: boolean }): React.ReactElement;
/** Testi della pipeline: vengono dal vocabolario della personalizzazione CRM (CRM-00) e dalle traduzioni; i default sono quelli del CRM «Generico» in italiano. */
export interface DealPipelineLabels { overline?: string; title?: string; open?: string; weighted?: string; filter?: string; newDeal?: string; total?: string; days?: string; daysTitle?: string; /** il ponderato sotto il totale delle fasi aperte, default «Ponderato» */ stageWeighted?: string; more?: string; seeAll?: string; /** «Sposta in {stage}» */ moveTo?: string; /** l'annuncio dopo «Sposta in…»: «{deal} spostata in {stage}» */ moved?: string; /** il nome del «⋯», seguito da «: » e dal titolo */ dealActions?: string; pipeline?: string; /** la prima voce del «⋯» con onOpen, default «Apri» */ openDeal?: string; /** l'annuncio quando onMove ferma o riporta indietro: «{deal} resta in {stage}» */ back?: string }
/** Fase: `kind` 'won' | 'lost' esclude la colonna dai totali aperti e ponderati; 'won' ha fondo success-soft. Senza `kind` valgono gli id 'won' e 'lost'. */
export interface DealStage { id: string; title: string; kind?: 'open' | 'won' | 'lost'; deals: Deal[]; /** dal modulo, quando carica solo una parte delle trattative: quante sono, totale e ponderato della fase. Senza, si contano e si sommano quelle in `deals`; ma con `hasMore`, o un `count` diverso dalle schede, un totale o un ponderato che manca non si mostra (sarebbe sbagliato) */ count?: number; total?: number; weighted?: number; /** «Mostra altre» in fondo alla colonna, con `onMore`; senza `count` il numero della colonna è quello delle schede caricate col «+» (50+) */ hasMore?: boolean; /** «Mostra altre» occupato mentre carica */ loadingMore?: boolean }
/** `stages` è anche controllabile: se cambia dall'esterno (nuova trattativa, fase rinominata) la pipeline si riallinea. `onOpen(deal)` al clic o Invio su una card (apre il `DetailPanel`). `currency` (codice ISO, default EUR) per importi e totali. */
export declare function DealPipeline(props: { title?: string; stages?: DealStage[]; labels?: DealPipelineLabels; companyIcon?: IconName | null; currency?: string; /** scrive totali, ponderati (non arrotondati) e importi delle schede senza `amountText`, nella valuta e lingua del modulo; senza, o se lancia un errore, euro (o `currency`) all'italiana (richiesta 190) */ formatAmount?: (value: number) => string; onNew?: () => void; onFilter?: () => void; onChange?: (s: DealStage[]) => void; onOpen?: (deal: Deal) => void;
  /** aperte e ponderate della testa, dal modulo; senza, la somma delle fasi aperte */ totals?: { open?: number; weighted?: number };
  /** «Mostra altre» delle fasi con `hasMore`; con l'ultima pagina (hasMore false) il fuoco passa alla prima scheda arrivata */ onMore?: (stageId: string) => void;
  /** «Vedi tutte» sulle fasi vinta e persa */ onSeeAll?: (stageId: string) => void;
  /** prima di ogni spostamento (trascinato o con «Sposta in…»): `false` lo ferma (niente onChange); una Promise rifiutata o risolta a `false` riporta la scheda dov'era, e mentre è in corso la scheda sta nella fase d'arrivo, occupata. Dopo lo smontaggio la risposta non cambia più niente */ onMove?: (deal: Deal, toStageId: string, fromStageId: string) => boolean | void | Promise<boolean | void>;
  /** voci in più nel «⋯» della scheda, dopo «Sposta in…» */ dealActions?: (deal: Deal) => MenuItem[];
  /** più pipeline (piano Team): il menu compare con più di una */ pipelines?: { id: string; name: string }[]; pipelineId?: string; onPipeline?: (id: string) => void }): React.ReactElement;
export interface Contact { id: string; name: string; email: string; company: string; status: string; owner: string; value: number; last: string }
export declare function CrmContacts(props: { contacts?: Contact[]; onOpen?: (c: Contact) => void; pageSize?: number }): React.ReactElement;
export declare function ContactDetail(props: { contact?: { name: string; role: string; company: string; status: string; email: string; phone: string; owner: string }; activities?: Activity[] }): React.ReactElement;
export declare function ReportDashboard(props: { title?: string }): React.ReactElement;
export interface FlowStep { id: string; type: 'trigger' | 'condition' | 'action' | 'delay'; title: string; detail?: string; icon?: IconName; stats?: string }
export declare function AutomationStep(props: FlowStep & { selected?: boolean; onClick?: () => void }): React.ReactElement;
export declare function WorkflowBuilder(props: { closeLabel?: string; name?: string; steps?: FlowStep[]; active?: boolean; defaultSelected?: string; onChange?: (s: FlowStep[]) => void }): React.ReactElement;
export declare function AutomationList(props: { automations?: { id: string | number; name: string; trigger: string; runs: number; last: string; status: 'Attiva' | 'In pausa' | 'Errore' }[]; onOpen?: (a: unknown) => void }): React.ReactElement;
export declare function ContentStudio(props: { onGenerate?: (form: { type: string; topic: string; audience: string; tone: string; length: string }) => Promise<{ id: string | number; text: string }[]>; onSave?: (v: { id: string | number; text: string }) => void; used?: number; limit?: number; autoGenerate?: boolean }): React.ReactElement;
/** I testi comuni dei componenti (la ✕, «Annulla», «Indietro», «Aggiungi», «Togli») nelle lingue del design system. */
export interface CommonLabels { /** la lingua dei testi (it, en, es): i testi propri dei componenti la seguono (richiesta 205) */ lang?: string; close: string; cancel: string; back: string; add: string; remove: string; /** il pallino di NotificationItem */ unread: string }
export declare const COMMON_LABELS: { it: CommonLabels; en: CommonLabels; es: CommonLabels };
/** Dà ai componenti dentro di sé i testi comuni nella lingua `lang`; senza, seguono `<html lang>` (letto a ogni disegno); una lingua che non c'è prende quella del `LabelsProvider` di sopra, poi `<html lang>`, poi l'inglese; senza nessuna lingua dichiarata, l'italiano. `labels` sostituisce un testo; la prop del componente (closeLabel…) vince sempre. */
export declare function LabelsProvider(props: { lang?: string; labels?: Partial<CommonLabels>; children?: React.ReactNode }): React.ReactElement;
/** I testi comuni del `LabelsProvider` più vicino (o di `<html lang>`), per i pulsanti che il modulo compone da sé. */
export declare function useLabels(): CommonLabels;
/** La riga di una notifica (P-07), la stessa del pannello della campanella: con href è un link, senza un pulsante. */
export declare function NotificationItem(props: Omit<ShellNotification, 'id' | 'forMe'> & { href?: string; onClick?: (e: React.MouseEvent) => void; /** il nome del pallino, default «non letta» nella lingua dell'app (`LabelsProvider`) */ unreadLabel?: string; className?: string }): React.ReactElement;

/** La riga di un appuntamento: data in un riquadro, titolo (link o pulsante con `href`/`onOpen`), stato, ora, luogo, azienda e azioni. Testi già scritti nella lingua del modulo (zr-account, zr-bookings). */
export interface AppointmentItemProps { title: string; weekday?: string; day: string; month?: string; /** la data per intero per il lettore di schermo, «mercoledì 12 novembre 2026» */ dateLabel?: string; time?: string; place?: string; online?: boolean; provider?: string; providerTone?: Exclude<Tone, 'neutral'>; status?: string; statusTone?: Tone; note?: string; href?: string; onOpen?: (e: React.MouseEvent) => void; actions?: React.ReactNode; past?: boolean; canceled?: boolean; compact?: boolean; className?: string }
export declare function AppointmentItem(props: AppointmentItemProps): React.ReactElement;
