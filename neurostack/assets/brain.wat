(module
  (memory (export "mem") 1)

  ;; ---------------- memory map (all 16-byte aligned) ----------------
  (global $A    i32 (i32.const 0))      ;; 5 rows x v128        0..79
  (global $B    i32 (i32.const 96))     ;; 4 act x 4 rows x v128 96..351
  (global $Z    i32 (i32.const 352))
  (global $ZU   i32 (i32.const 368))
  (global $PZ   i32 (i32.const 384))
  (global $ERR  i32 (i32.const 400))    ;; 8 f32 (5 used)
  (global $PRED i32 (i32.const 432))
  (global $TE   i32 (i32.const 464))
  (global $HAB  i32 (i32.const 480))
  (global $G    i32 (i32.const 496))
  (global $RISK i32 (i32.const 512))
  (global $AMB  i32 (i32.const 528))
  (global $NOV  i32 (i32.const 544))
  (global $S    i32 (i32.const 560))
  (global $ZTT  i32 (i32.const 688))    ;; transposed z' : j -> lanes = actions
  (global $ONX  i32 (i32.const 752))
  (global $DVEC i32 (i32.const 832))
  (global $NMV  i32 (i32.const 864))    ;; non-motor v    (12 f32)
  (global $NMT  i32 (i32.const 912))    ;; non-motor thr
  (global $NMR  i32 (i32.const 960))    ;; non-motor rate
  (global $NMF  i32 (i32.const 1008))   ;; non-motor refrac
  (global $NMI  i32 (i32.const 1056))   ;; non-motor input
  (global $MV   i32 (i32.const 1104))
  (global $MT   i32 (i32.const 1120))
  (global $MR   i32 (i32.const 1136))
  (global $MF   i32 (i32.const 1152))
  (global $MI   i32 (i32.const 1168))
  (global $P    i32 (i32.const 1184))   ;; params[32]
  (global $PC   i32 (i32.const 1312))   ;; pref C
  (global $PW   i32 (i32.const 1344))   ;; pref W
  (global $DX   i32 (i32.const 1376))
  (global $DY   i32 (i32.const 1392))
  (global $SC   i32 (i32.const 1408))   ;; [0]drive [1]stuck [2]gspread [3]temp [4]meanErr
  (global $CTL  i32 (i32.const 1440))   ;; i32: [0]curAction [1]prevA [2]eegHead
  (global $RNG  i32 (i32.const 1456))   ;; v128 xorshift state
  (global $EEG  i32 (i32.const 1536))   ;; 13 rows x 128 f32 ring

  (global $EL i32 (i32.const 128))      ;; ring length (power of two)

  ;; ---------------- scalar helpers ----------------
  (func $ld (param $b i32) (param $i i32) (result f32)
    (f32.load (i32.add (local.get $b) (i32.shl (local.get $i) (i32.const 2)))))
  (func $st (param $b i32) (param $i i32) (param $v f32)
    (f32.store (i32.add (local.get $b) (i32.shl (local.get $i) (i32.const 2))) (local.get $v)))
  (func $par (param $i i32) (result f32) (call $ld (global.get $P) (local.get $i)))
  (func $cl (param $x f32) (param $lo f32) (param $hi f32) (result f32)
    (f32.min (f32.max (local.get $x) (local.get $lo)) (local.get $hi)))

  ;; ---------------- vector helpers ----------------
  (func $clv (param $v v128) (param $lo f32) (param $hi f32) (result v128)
    (f32x4.min (f32x4.max (local.get $v) (f32x4.splat (local.get $lo)))
               (f32x4.splat (local.get $hi))))

  (func $hsum (param $v v128) (result f32)
    (f32.add
      (f32.add (f32x4.extract_lane 0 (local.get $v)) (f32x4.extract_lane 1 (local.get $v)))
      (f32.add (f32x4.extract_lane 2 (local.get $v)) (f32x4.extract_lane 3 (local.get $v)))))

  (func $lmin (param $v v128) (result f32)
    (f32.min (f32.min (f32x4.extract_lane 0 (local.get $v)) (f32x4.extract_lane 1 (local.get $v)))
             (f32.min (f32x4.extract_lane 2 (local.get $v)) (f32x4.extract_lane 3 (local.get $v)))))

  (func $lmax (param $v v128) (result f32)
    (f32.max (f32.max (f32x4.extract_lane 0 (local.get $v)) (f32x4.extract_lane 1 (local.get $v)))
             (f32.max (f32x4.extract_lane 2 (local.get $v)) (f32x4.extract_lane 3 (local.get $v)))))

  ;; dot(row @ ptr, z)
  (func $dot (param $p i32) (param $z v128) (result f32)
    (call $hsum (f32x4.mul (v128.load (local.get $p)) (local.get $z))))

  ;; 4 independent xorshift32 streams -> [0,1)^4
  (func $rnd4 (result v128)
    (local $x v128)
    (local.set $x (v128.load (global.get $RNG)))
    (local.set $x (v128.xor (local.get $x) (i32x4.shl   (local.get $x) (i32.const 13))))
    (local.set $x (v128.xor (local.get $x) (i32x4.shr_u (local.get $x) (i32.const 17))))
    (local.set $x (v128.xor (local.get $x) (i32x4.shl   (local.get $x) (i32.const 5))))
    (v128.store (global.get $RNG) (local.get $x))
    (f32x4.mul (f32x4.convert_i32x4_u (i32x4.shr_u (local.get $x) (i32.const 8)))
               (f32x4.splat (f32.const 5.9604645e-8))))

  ;; ================= INFERENCE =================
  (func $infer
    (local $zv v128) (local $g v128) (local $i i32) (local $p f32)
    (local.set $zv (v128.load (global.get $Z)))
    ;; pred = clamp(A z, -1, 1);  err = s - pred
    (local.set $i (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $i) (i32.const 5)))
      (local.set $p (call $cl
        (call $dot (i32.add (global.get $A) (i32.shl (local.get $i) (i32.const 4))) (local.get $zv))
        (f32.const -1) (f32.const 1)))
      (call $st (global.get $PRED) (local.get $i) (local.get $p))
      (call $st (global.get $ERR) (local.get $i)
        (f32.sub (call $ld (global.get $S) (local.get $i)) (local.get $p)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    ;; grad = Aᵀ err  ==  Σ_i err[i] * Arow_i     (pure SIMD, no transpose)
    (local.set $g (v128.const f32x4 0 0 0 0))
    (local.set $i (i32.const 0))
    (block $b2 (loop $l2
      (br_if $b2 (i32.ge_u (local.get $i) (i32.const 5)))
      (local.set $g (f32x4.add (local.get $g)
        (f32x4.mul (f32x4.splat (call $ld (global.get $ERR) (local.get $i)))
                   (v128.load (i32.add (global.get $A) (i32.shl (local.get $i) (i32.const 4)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l2)))
    (v128.store (global.get $ZU) (local.get $zv))
    (v128.store (global.get $Z) (call $clv
      (f32x4.add (local.get $zv)
        (f32x4.mul (f32x4.splat (call $par (i32.const 0)))
          (f32x4.sub (local.get $g)
            (f32x4.mul (f32x4.splat (call $par (i32.const 1))) (local.get $zv)))))
      (f32.const 0) (f32.const 1))))

  ;; ================= EFE : 4 ACTIONS IN 4 LANES =================
  (func $evaluate
    (local $zv v128) (local $ov v128) (local $rv v128) (local $dv v128) (local $gv v128)
    (local $a i32) (local $j i32) (local $i i32) (local $prec f32) (local $w f32)
    (local.set $zv (v128.load (global.get $Z)))
    ;; zTt[j] lane a = clamp01(B[a] row j . z)
    (local.set $a (i32.const 0))
    (block $ba (loop $la
      (br_if $ba (i32.ge_u (local.get $a) (i32.const 4)))
      (local.set $j (i32.const 0))
      (block $bj (loop $lj
        (br_if $bj (i32.ge_u (local.get $j) (i32.const 4)))
        (f32.store
          (i32.add (i32.add (global.get $ZTT) (i32.shl (local.get $j) (i32.const 4)))
                   (i32.shl (local.get $a) (i32.const 2)))
          (call $cl (call $dot
              (i32.add (i32.add (global.get $B) (i32.shl (local.get $a) (i32.const 6)))
                       (i32.shl (local.get $j) (i32.const 4)))
              (local.get $zv))
            (f32.const 0) (f32.const 1)))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $lj)))
      (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $la)))
    ;; risk for all 4 actions simultaneously
    (local.set $prec (f32.add (f32.const 0.4)
      (f32.mul (f32.const 2.2) (call $ld (global.get $SC) (i32.const 0)))))
    (local.set $rv (v128.const f32x4 0 0 0 0))
    (local.set $i (i32.const 0))
    (block $bi (loop $li
      (br_if $bi (i32.ge_u (local.get $i) (i32.const 5)))
      (local.set $ov (v128.const f32x4 0 0 0 0))
      (local.set $j (i32.const 0))
      (block $b2 (loop $l2
        (br_if $b2 (i32.ge_u (local.get $j) (i32.const 4)))
        (local.set $ov (f32x4.add (local.get $ov)
          (f32x4.mul (f32x4.splat (call $ld (global.get $A)
                       (i32.add (i32.shl (local.get $i) (i32.const 2)) (local.get $j))))
                     (v128.load (i32.add (global.get $ZTT) (i32.shl (local.get $j) (i32.const 4)))))))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $l2)))
      (local.set $ov (call $clv (local.get $ov) (f32.const -1) (f32.const 1)))
      (local.set $dv (f32x4.sub (local.get $ov)
        (f32x4.splat (call $ld (global.get $PC) (local.get $i)))))
      (local.set $w (f32.mul (call $ld (global.get $PW) (local.get $i))
        (select (local.get $prec) (f32.const 1) (i32.eq (local.get $i) (i32.const 2)))))
      (local.set $rv (f32x4.add (local.get $rv)
        (f32x4.mul (f32x4.splat (local.get $w))
                   (f32x4.mul (local.get $dv) (local.get $dv)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $li)))
    ;; wall term, 4-wide
    (local.set $rv (f32x4.add (local.get $rv)
      (f32x4.mul
        (f32x4.splat (f32.mul (call $par (i32.const 20))
          (f32.add (f32.const 1) (call $ld (global.get $SC) (i32.const 1)))))
        (call $clv
          (f32x4.add
            (f32x4.mul (v128.load (global.get $DX))
              (f32x4.splat (call $cl (call $ld (global.get $PRED) (i32.const 3)) (f32.const -1) (f32.const 1))))
            (f32x4.mul (v128.load (global.get $DY))
              (f32x4.splat (call $cl (call $ld (global.get $PRED) (i32.const 4)) (f32.const -1) (f32.const 1)))))
          (f32.const 0) (f32.const 1)))))
    (v128.store (global.get $RISK) (local.get $rv))
    (v128.store (global.get $AMB) (v128.load (global.get $TE)))
    (local.set $gv (f32x4.sub (f32x4.sub
        (f32x4.add (local.get $rv)
          (f32x4.mul (f32x4.splat (call $par (i32.const 17))) (v128.load (global.get $TE))))
        (f32x4.mul (f32x4.splat (call $par (i32.const 18))) (v128.load (global.get $NOV))))
        (f32x4.mul (f32x4.splat (call $par (i32.const 19))) (v128.load (global.get $HAB)))))
    (v128.store (global.get $G) (local.get $gv))
    (call $st (global.get $SC) (i32.const 2)
      (f32.sub (call $lmax (local.get $gv)) (call $lmin (local.get $gv)))))

  ;; ================= LIF =================
  (func $lif
    (local $gv v128) (local $gmin f32) (local $me f32) (local $temp f32)
    (local $i i32) (local $a i32) (local $k i32)
    (local $v v128) (local $thr v128) (local $ref v128) (local $rate v128)
    (local $isref v128) (local $vn v128) (local $spk v128) (local $spv v128)
    (local $r4 v128) (local $sv f32) (local $vv f32)
    (local.set $gv (v128.load (global.get $G)))
    (local.set $gmin (call $lmin (local.get $gv)))
    ;; mean |err|
    (local.set $me (f32.div (call $hsum (f32x4.abs (v128.load (global.get $ERR))))
                            (f32.const 5)))
    (local.set $me (f32.add (local.get $me)
      (f32.div (f32.abs (call $ld (global.get $ERR) (i32.const 4))) (f32.const 5))))
    (call $st (global.get $SC) (i32.const 4) (local.get $me))
    ;; temperature
    (local.set $temp (f32.min (call $par (i32.const 16))
      (f32.mul (f32.mul (call $par (i32.const 12))
        (f32.add (f32.const 1) (f32.div (f32.const 3)
          (f32.add (f32.const 1) (f32.mul (call $par (i32.const 13))
                                          (call $ld (global.get $SC) (i32.const 2)))))))
        (f32.mul (f32.add (f32.const 1) (f32.mul (call $par (i32.const 14)) (local.get $me)))
                 (f32.add (f32.add (f32.const 1)
                    (f32.mul (call $par (i32.const 15)) (call $ld (global.get $SC) (i32.const 0))))
                    (f32.mul (call $par (i32.const 21)) (call $ld (global.get $SC) (i32.const 1))))))))
    (call $st (global.get $SC) (i32.const 3) (local.get $temp))

    ;; --- input currents ---
    ;; sensors 0..3 (vector), sensor 4 (scalar)
    (local.set $r4 (call $rnd4))
    (v128.store (global.get $NMI)
      (f32x4.add (f32x4.add (f32x4.splat (f32.const 0.55))
        (f32x4.mul (f32x4.splat (f32.const 2.6))
          (call $clv (f32x4.abs (f32x4.add (v128.load (global.get $PRED))
                                           (v128.load (global.get $ERR))))
                     (f32.const 0) (f32.const 1))))
        (f32x4.mul (local.get $r4) (f32x4.splat (f32.const 0.12)))))
    (call $st (global.get $NMI) (i32.const 4)
      (f32.add (f32.add (f32.const 0.55)
        (f32.mul (f32.const 2.6) (call $cl (f32.abs (f32.add
            (call $ld (global.get $PRED) (i32.const 4))
            (call $ld (global.get $ERR) (i32.const 4)))) (f32.const 0) (f32.const 1))))
        (f32.mul (f32x4.extract_lane 0 (call $rnd4)) (f32.const 0.12))))
    ;; latents -> nmI[5..8]  (unaligned v128 store)
    (v128.store offset=20 (global.get $NMI)
      (f32x4.add (f32x4.add (f32x4.splat (f32.const 0.9))
        (f32x4.mul (f32x4.splat (f32.const 3)) (v128.load (global.get $Z))))
        (f32x4.mul (call $rnd4) (f32x4.splat (f32.const 0.12)))))
    ;; motors
    (v128.store (global.get $MI)
      (f32x4.add (f32x4.sub (f32x4.splat (f32.const 1.75))
        (f32x4.mul (f32x4.splat (call $par (i32.const 11)))
                   (f32x4.sub (local.get $gv) (f32x4.splat (local.get $gmin)))))
        (f32x4.mul (call $rnd4) (f32x4.splat (local.get $temp)))))

    ;; --- branchless membrane update for the 9 sensory+latent neurons (3 vectors) ---
    (local.set $i (i32.const 0))
    (block $bv (loop $lv
      (br_if $bv (i32.ge_u (local.get $i) (i32.const 48)))
      (local.set $v    (v128.load (i32.add (global.get $NMV) (local.get $i))))
      (local.set $thr  (v128.load (i32.add (global.get $NMT) (local.get $i))))
      (local.set $ref  (v128.load (i32.add (global.get $NMF) (local.get $i))))
      (local.set $rate (v128.load (i32.add (global.get $NMR) (local.get $i))))
      (local.set $isref (f32x4.gt (local.get $ref) (v128.const f32x4 0 0 0 0)))
      (local.set $vn (f32x4.add (local.get $v)
        (f32x4.div (f32x4.sub (v128.load (i32.add (global.get $NMI) (local.get $i))) (local.get $v))
                   (f32x4.splat (call $par (i32.const 6))))))
      (local.set $spk (v128.andnot (f32x4.gt (local.get $vn) (local.get $thr)) (local.get $isref)))
      (v128.store (i32.add (global.get $NMV) (local.get $i))
        (v128.bitselect (v128.const f32x4 0 0 0 0)
          (v128.bitselect (v128.const f32x4 0 0 0 0) (local.get $vn) (local.get $spk))
          (local.get $isref)))
      (v128.store (i32.add (global.get $NMF) (local.get $i))
        (v128.bitselect (f32x4.sub (local.get $ref) (f32x4.splat (f32.const 1)))
          (v128.bitselect (f32x4.splat (call $par (i32.const 7)))
                          (v128.const f32x4 0 0 0 0) (local.get $spk))
          (local.get $isref)))
      (local.set $spv (v128.and (local.get $spk) (f32x4.splat (f32.const 1))))
      (local.set $rate (f32x4.add (local.get $rate)
        (f32x4.div (f32x4.sub (local.get $spv) (local.get $rate))
                   (f32x4.splat (call $par (i32.const 8))))))
      (v128.store (i32.add (global.get $NMR) (local.get $i)) (local.get $rate))
      (v128.store (i32.add (global.get $NMT) (local.get $i))
        (call $clv (f32x4.add (local.get $thr)
            (f32x4.mul (f32x4.splat (call $par (i32.const 4)))
              (f32x4.sub (local.get $rate) (f32x4.splat (call $par (i32.const 5))))))
          (call $par (i32.const 9)) (call $par (i32.const 10))))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $lv)))

    ;; --- motor neurons: scalar, order-faithful (winner-take-all inhibition) ---
    (local.set $a (i32.const 0))
    (block $bm (loop $lm
      (br_if $bm (i32.ge_u (local.get $a) (i32.const 4)))
      (local.set $sv (f32.const 0))
      (if (f32.gt (call $ld (global.get $MF) (local.get $a)) (f32.const 0))
        (then
          (call $st (global.get $MF) (local.get $a)
            (f32.sub (call $ld (global.get $MF) (local.get $a)) (f32.const 1)))
          (call $st (global.get $MV) (local.get $a) (f32.const 0)))
        (else
          (local.set $vv (call $ld (global.get $MV) (local.get $a)))
          (local.set $vv (f32.add (local.get $vv)
            (f32.div (f32.sub (call $ld (global.get $MI) (local.get $a)) (local.get $vv))
                     (call $par (i32.const 6)))))
          (if (f32.gt (local.get $vv) (call $ld (global.get $MT) (local.get $a)))
            (then
              (local.set $sv (f32.const 1))
              (local.set $vv (f32.const 0))
              (call $st (global.get $MF) (local.get $a) (call $par (i32.const 7)))
              (if (i32.lt_s (i32.load (global.get $CTL)) (i32.const 0))
                (then (i32.store (global.get $CTL) (local.get $a))))
              (local.set $k (i32.const 0))
              (block $bk (loop $lk
                (br_if $bk (i32.ge_u (local.get $k) (i32.const 4)))
                (if (i32.ne (local.get $k) (local.get $a))
                  (then (call $st (global.get $MV) (local.get $k)
                          (f32.mul (call $ld (global.get $MV) (local.get $k)) (f32.const 0.12)))))
                (local.set $k (i32.add (local.get $k) (i32.const 1))) (br $lk)))))
          (call $st (global.get $MV) (local.get $a) (local.get $vv))))
      (call $st (global.get $MR) (local.get $a)
        (f32.add (call $ld (global.get $MR) (local.get $a))
          (f32.div (f32.sub (local.get $sv) (call $ld (global.get $MR) (local.get $a)))
                   (call $par (i32.const 8)))))
      (local.set $a (i32.add (local.get $a) (i32.const 1))) (br $lm))))

  ;; ================= EEG RING =================
  (func $eeg
    (local $i i32) (local $h i32) (local $base i32)
    (local.set $h (i32.and (i32.add (i32.load offset=8 (global.get $CTL)) (i32.const 1))
                           (i32.const 127)))
    (i32.store offset=8 (global.get $CTL) (local.get $h))
    (local.set $i (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $i) (i32.const 9)))
      (call $st (i32.add (global.get $EEG)
                  (i32.mul (local.get $i) (i32.const 512))) (local.get $h)
        (select (f32.const 1.7) (call $ld (global.get $NMV) (local.get $i))
                (f32.gt (call $ld (global.get $NMF) (local.get $i)) (f32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    (local.set $i (i32.const 0))
    (block $b2 (loop $l2
      (br_if $b2 (i32.ge_u (local.get $i) (i32.const 4)))
      (call $st (i32.add (global.get $EEG)
                  (i32.mul (i32.add (local.get $i) (i32.const 9)) (i32.const 512))) (local.get $h)
        (select (f32.const 1.7) (call $ld (global.get $MV) (local.get $i))
                (f32.gt (call $ld (global.get $MF) (local.get $i)) (f32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l2))))

  ;; ================= LEARNING =================
  (func $normA
    (local $i i32) (local $n v128) (local $s v128) (local $row v128)
    (local.set $n (v128.const f32x4 0 0 0 0))
    (local.set $i (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $i) (i32.const 80)))
      (local.set $row (v128.load (i32.add (global.get $A) (local.get $i))))
      (local.set $n (f32x4.add (local.get $n) (f32x4.mul (local.get $row) (local.get $row))))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $l)))
    ;; scale = min(1, 1.5 / ||col||)   <- column norms live in lanes
    (local.set $s (f32x4.min (f32x4.splat (f32.const 1))
      (f32x4.div (f32x4.splat (f32.const 1.5)) (f32x4.sqrt (local.get $n)))))
    (local.set $i (i32.const 0))
    (block $b2 (loop $l2
      (br_if $b2 (i32.ge_u (local.get $i) (i32.const 80)))
      (v128.store (i32.add (global.get $A) (local.get $i))
        (f32x4.mul (v128.load (i32.add (global.get $A) (local.get $i))) (local.get $s)))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $l2))))

  (func $learnA
    (local $i i32) (local $zu v128)
    (local.set $zu (v128.load (global.get $ZU)))
    (local.set $i (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $i) (i32.const 5)))
      (v128.store (i32.add (global.get $A) (i32.shl (local.get $i) (i32.const 4)))
        (call $clv
          (f32x4.add (v128.load (i32.add (global.get $A) (i32.shl (local.get $i) (i32.const 4))))
            (f32x4.mul (f32x4.splat (f32.mul (call $par (i32.const 2))
                                             (call $ld (global.get $ERR) (local.get $i))))
                       (local.get $zu)))
          (f32.const -2) (f32.const 2)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    (call $normA))

  (func $learnB
    (local $a i32) (local $j i32) (local $bp i32) (local $pz v128) (local $d v128)
    (local.set $a (i32.load offset=4 (global.get $CTL)))
    (if (i32.lt_s (local.get $a) (i32.const 0)) (then (return)))
    (local.set $bp (i32.add (global.get $B) (i32.shl (local.get $a) (i32.const 6))))
    (local.set $pz (v128.load (global.get $PZ)))
    (local.set $j (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $j) (i32.const 4)))
      (call $st (global.get $DVEC) (local.get $j)
        (f32.sub (call $ld (global.get $Z) (local.get $j))
          (call $cl (call $dot (i32.add (local.get $bp) (i32.shl (local.get $j) (i32.const 4)))
                              (local.get $pz)) (f32.const 0) (f32.const 1))))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $l)))
    (local.set $d (v128.load (global.get $DVEC)))
    (local.set $j (i32.const 0))
    (block $b2 (loop $l2
      (br_if $b2 (i32.ge_u (local.get $j) (i32.const 4)))
      (v128.store (i32.add (local.get $bp) (i32.shl (local.get $j) (i32.const 4)))
        (call $clv
          (f32x4.add (v128.load (i32.add (local.get $bp) (i32.shl (local.get $j) (i32.const 4))))
            (f32x4.mul (f32x4.splat (f32.mul (call $par (i32.const 3))
                                             (call $ld (global.get $DVEC) (local.get $j))))
                       (local.get $pz)))
          (f32.const -1.5) (f32.const 1.5)))
      (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $l2)))
    (call $st (global.get $TE) (local.get $a)
      (f32.add (call $ld (global.get $TE) (local.get $a))
        (f32.mul (f32.const 0.15)
          (f32.sub (f32.div (call $hsum (f32x4.abs (local.get $d))) (f32.const 4))
                   (call $ld (global.get $TE) (local.get $a)))))))

  ;; ================= EXPORTED API =================
  (func (export "beginTick")
    (local $a i32) (local $j i32) (local $bp i32) (local $pz v128) (local $t v128)
    (i32.store (global.get $CTL) (i32.const -1))
    (local.set $a (i32.load offset=4 (global.get $CTL)))
    (if (i32.ge_s (local.get $a) (i32.const 0)) (then
      (local.set $bp (i32.add (global.get $B) (i32.shl (local.get $a) (i32.const 6))))
      (local.set $pz (v128.load (global.get $PZ)))
      (local.set $t (v128.const f32x4 0 0 0 0))
      (local.set $j (i32.const 0))
      (block $b (loop $l
        (br_if $b (i32.ge_u (local.get $j) (i32.const 4)))
        (call $st (global.get $DVEC) (local.get $j)
          (call $dot (i32.add (local.get $bp) (i32.shl (local.get $j) (i32.const 4))) (local.get $pz)))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $l)))
      (v128.store (global.get $Z)
        (call $clv (v128.load (global.get $DVEC)) (f32.const 0) (f32.const 1))))))

  ;; run k substeps in one call; returns first motor action of the tick (or -1)
  (func (export "run") (param $k i32) (result i32)
    (block $b (loop $l
      (br_if $b (i32.le_s (local.get $k) (i32.const 0)))
      (call $infer) (call $evaluate) (call $lif) (call $eeg)
      (local.set $k (i32.sub (local.get $k) (i32.const 1))) (br $l)))
    (i32.load (global.get $CTL)))

  (func (export "endTick") (param $a i32)
    ;; transErr += 0.02 * (0.15 - transErr)   (4-wide)
    (v128.store (global.get $TE)
      (f32x4.add (v128.load (global.get $TE))
        (f32x4.mul (f32x4.splat (f32.const 0.02))
          (f32x4.sub (f32x4.splat (f32.const 0.15)) (v128.load (global.get $TE))))))
    (call $learnA)
    (call $learnB)
    (i32.store offset=4 (global.get $CTL) (local.get $a))
    (v128.store (global.get $PZ) (v128.load (global.get $Z))))

  (func (export "reset") (param $seed i32)
    (local $i i32) (local $j i32)
    (memory.fill (i32.const 0) (i32.const 0) (i32.const 1184))
    (memory.fill (global.get $EEG) (i32.const 0) (i32.const 6656))
    (i32.store (global.get $CTL) (i32.const -1))
    (i32.store offset=4 (global.get $CTL) (i32.const -1))
    (i32.store offset=8 (global.get $CTL) (i32.const 0))
    (v128.store (global.get $RNG)
      (i32x4.replace_lane 3 (i32x4.replace_lane 2 (i32x4.replace_lane 1 (i32x4.replace_lane 0
        (v128.const i32x4 0 0 0 0) (i32.or (local.get $seed) (i32.const 1)))
        (i32.xor (local.get $seed) (i32.const 0x9e3779b9)))
        (i32.xor (local.get $seed) (i32.const 0x85ebca6b)))
        (i32.xor (local.get $seed) (i32.const 0xc2b2ae35))))
    ;; A ~ U(-0.5,0.5)
    (local.set $i (i32.const 0))
    (block $b (loop $l
      (br_if $b (i32.ge_u (local.get $i) (i32.const 80)))
      (v128.store (i32.add (global.get $A) (local.get $i))
        (f32x4.sub (call $rnd4) (f32x4.splat (f32.const 0.5))))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $l)))
    ;; B ~ 0.9 I + U(-0.05,0.05)
    (local.set $i (i32.const 0))
    (block $b2 (loop $l2
      (br_if $b2 (i32.ge_u (local.get $i) (i32.const 256)))
      (v128.store (i32.add (global.get $B) (local.get $i))
        (f32x4.mul (f32x4.sub (call $rnd4) (f32x4.splat (f32.const 0.5)))
                   (f32x4.splat (f32.const 0.1))))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $l2)))
    (local.set $i (i32.const 0))
    (block $b3 (loop $l3
      (br_if $b3 (i32.ge_u (local.get $i) (i32.const 4)))
      (local.set $j (i32.const 0))
      (block $b4 (loop $l4
        (br_if $b4 (i32.ge_u (local.get $j) (i32.const 4)))
        (call $st (i32.add (i32.add (global.get $B) (i32.shl (local.get $i) (i32.const 6)))
                           (i32.shl (local.get $j) (i32.const 4))) (local.get $j)
          (f32.add (call $ld (i32.add (i32.add (global.get $B) (i32.shl (local.get $i) (i32.const 6)))
                                      (i32.shl (local.get $j) (i32.const 4))) (local.get $j))
                   (f32.const 0.9)))
        (local.set $j (i32.add (local.get $j) (i32.const 1))) (br $l4)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l3)))
    (v128.store (global.get $Z)  (v128.const f32x4 0.2 0.2 0.2 0.2))
    (v128.store (global.get $ZU) (v128.const f32x4 0.2 0.2 0.2 0.2))
    (v128.store (global.get $PZ) (v128.const f32x4 0.2 0.2 0.2 0.2))
    (v128.store (global.get $TE) (v128.const f32x4 0.4 0.4 0.4 0.4))
    (v128.store (global.get $MT) (v128.const f32x4 1 1 1 1))
    (local.set $i (i32.const 0))
    (block $b5 (loop $l5
      (br_if $b5 (i32.ge_u (local.get $i) (i32.const 48)))
      (v128.store (i32.add (global.get $NMT) (local.get $i)) (v128.const f32x4 1 1 1 1))
      (local.set $i (i32.add (local.get $i) (i32.const 16))) (br $l5)))
    (call $normA))
)