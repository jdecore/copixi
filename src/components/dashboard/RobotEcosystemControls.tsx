import { ROBOT_UNITS, type RobotUnitId } from '../../types/mascota'
import { useDashboard, type PipelineStep } from '../../state/DashboardContext'
import './RobotEcosystemControls.css'

const PIPELINE_STEPS: { step: PipelineStep; robot: RobotUnitId; label: string; desc: string }[] = [
  { step: 'cleaning', robot: 'helix', label: '1. Limpieza & ADN', desc: 'Helix cura nulos, fechas y anomalías' },
  { step: 'profiling', robot: 'datum', label: '2. Taxonomía', desc: 'Datum genera estadísticas deterministas' },
  { step: 'patterns', robot: 'synapse', label: '3. Patrones IA', desc: 'Synapse detecta correlaciones y clusters' },
  { step: 'charts', robot: 'nexus', label: '4. Pipeline Visual', desc: 'Nexus configura gráficos y filtros' },
  { step: 'strategy', robot: 'vektor', label: '5. Estrategia', desc: 'Vektor formula decisiones y reporte' },
]

export function RobotEcosystemControls() {
  const {
    analysisMode,
    setAnalysisMode,
    activeRobot,
    setActiveRobot,
    pipelineStep,
    setPipelineStep,
    cleaningDiagnosis,
    applyCleaning,
    undoCleaning,
    cleaningHistory,
    lastCleaningResult,
    rawRows,
  } = useDashboard()

  const handleStepClick = (step: PipelineStep, robot: RobotUnitId) => {
    setPipelineStep(step)
    setActiveRobot(robot)
  }

  const handleApplyRecommendedCleaning = () => {
    if (!cleaningDiagnosis?.recommendedOperations.length) return
    applyCleaning(cleaningDiagnosis.recommendedOperations)
  }

  const activeMeta = ROBOT_UNITS[activeRobot] || ROBOT_UNITS.helix

  return (
    <div className="robot-ecosystem-wrapper" role="region" aria-label="Ecosistema de Robots de Copixi">
      {/* 1. Selector de Modo: Pipeline Asistido vs Especialista */}
      <div className="mode-toggle-bar">
        <div className="mode-segmented-control" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === 'pipeline'}
            className={`mode-btn ${analysisMode === 'pipeline' ? 'active' : ''}`}
            onClick={() => {
              setAnalysisMode('pipeline')
              const current = PIPELINE_STEPS.find((s) => s.step === pipelineStep)
              if (current) setActiveRobot(current.robot)
            }}
          >
            <span className="mode-icon">🔄</span> Pipeline Asistido
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={analysisMode === 'specialist'}
            className={`mode-btn ${analysisMode === 'specialist' ? 'active' : ''}`}
            onClick={() => setAnalysisMode('specialist')}
          >
            <span className="mode-icon">🤖</span> Modo Especialista
          </button>
        </div>

        <div className="active-habitat-badge" style={{ borderColor: activeMeta.primaryColor }}>
          <span className="habitat-dot" style={{ backgroundColor: activeMeta.primaryColor }} />
          <span className="habitat-name">{activeMeta.habitatName}</span>
        </div>
      </div>

      {/* 2. Vista de Modo Pipeline Asistido */}
      {analysisMode === 'pipeline' && (
        <div className="pipeline-stepper" role="navigation" aria-label="Pasos del Pipeline Asistido">
          {PIPELINE_STEPS.map((s, idx) => {
            const isCurrent = pipelineStep === s.step
            const meta = ROBOT_UNITS[s.robot]
            return (
              <button
                key={s.step}
                type="button"
                className={`pipeline-step-item ${isCurrent ? 'active' : ''}`}
                onClick={() => handleStepClick(s.step, s.robot)}
                style={{
                  ['--step-color' as string]: meta.primaryColor,
                } as React.CSSProperties}
              >
                <div className="step-indicator">
                  <span className="step-num">{idx + 1}</span>
                  <span className="step-unit-code">{meta.code}</span>
                </div>
                <div className="step-text">
                  <span className="step-label">{s.label}</span>
                  <span className="step-desc">{s.desc}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* 3. Vista de Modo Especialista (Dock de Robots) */}
      {analysisMode === 'specialist' && (
        <div className="specialist-dock" role="tablist" aria-label="Especialistas Robóticos">
          {(Object.keys(ROBOT_UNITS) as RobotUnitId[]).map((unitKey) => {
            const meta = ROBOT_UNITS[unitKey]
            const isSelected = activeRobot === unitKey
            return (
              <button
                key={unitKey}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`specialist-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setActiveRobot(unitKey)}
                style={{
                  ['--chip-color' as string]: meta.primaryColor,
                } as React.CSSProperties}
              >
                <span className="chip-code">{meta.code}</span>
                <span className="chip-name">{meta.name}</span>
                <span className="chip-domain">{meta.domain}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* 4. Panel Especial de Curación y Limpieza (HELIX-BOT) */}
      {rawRows && (activeRobot === 'helix' || pipelineStep === 'cleaning') && (
        <div className="helix-cleaning-card">
          <div className="helix-card-header">
            <div className="helix-card-title">
              <span className="dna-badge">🧬 UNIT H-02: HELIX-BOT</span>
              <h4>Diagnóstico y Curación de Datos</h4>
            </div>
            {cleaningHistory.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary small undo-btn"
                onClick={undoCleaning}
                title="Revertir última operación de limpieza"
              >
                ↩ Deshacer Limpieza
              </button>
            )}
          </div>

          <div className="helix-diagnosis-grid">
            <div className="diag-pill">
              <span className="diag-label">Duplicados</span>
              <span className="diag-val">{cleaningDiagnosis?.duplicateRows ?? 0} filas</span>
            </div>
            <div className="diag-pill">
              <span className="diag-label">Columnas con Nulos</span>
              <span className="diag-val">{cleaningDiagnosis?.nullReport.length ?? 0} columnas</span>
            </div>
            <div className="diag-pill">
              <span className="diag-label">Outliers Detectados</span>
              <span className="diag-val">
                {cleaningDiagnosis?.outlierReport.reduce((acc, o) => acc + o.outlierCount, 0) ?? 0}
              </span>
            </div>
            <div className="diag-pill">
              <span className="diag-label">Fechas Inconsistentes</span>
              <span className="diag-val">{cleaningDiagnosis?.inconsistentDates.length ?? 0}</span>
            </div>
          </div>

          {cleaningDiagnosis && cleaningDiagnosis.recommendedOperations.length > 0 && (
            <div className="helix-action-box">
              <p className="helix-recommendation-text">
                <strong>Recomendación de Helix:</strong> Se identificaron {cleaningDiagnosis.recommendedOperations.length} correcciones automáticas (imputación de nulos por mediana/moda, normalización ISO de fechas y eliminación de espacios redundantes).
              </p>
              <button
                type="button"
                className="btn btn-primary small apply-cleaning-btn"
                onClick={handleApplyRecommendedCleaning}
              >
                ✨ Aplicar Curación Recomendada
              </button>
            </div>
          )}

          {lastCleaningResult && (
            <div className="cleaning-success-banner">
              <span>✓ {lastCleaningResult.summary}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
